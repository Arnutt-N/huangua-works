import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteResolutionPhotoAction,
  uploadResolutionPhotoAction,
} from './cases';
import * as storage from '@/lib/storage';
import * as requireStaffModule from '@/lib/auth/require-staff';
import * as dbModule from '@/lib/db';
import * as auditModule from '@/lib/audit';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Resolution Photo Server Actions', () => {
  beforeEach(() => {
    vi.spyOn(requireStaffModule, 'requireStaff').mockResolvedValue({
      user: {
        id: 'staff-1',
        fullName: 'เจ้าหน้าที่ ทดสอบ',
        email: 'staff@test.local',
        role: 'officer',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    } as unknown as Awaited<ReturnType<typeof requireStaffModule.requireStaff>>);

    vi.spyOn(auditModule, 'logAudit').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadResolutionPhotoAction', () => {
    it('คืนค่าข้อผิดพลาดเมื่อระบบจัดเก็บไฟล์ยังไม่ได้ตั้งค่า', async () => {
      vi.spyOn(storage, 'isStorageConfigured').mockReturnValue(false);

      const formData = new FormData();
      formData.append('caseId', 'c-1');
      formData.append('tag', 'before');

      const res = await uploadResolutionPhotoAction({ error: null }, formData);
      expect(res.error).toContain('ระบบจัดเก็บไฟล์ยังไม่เปิดใช้งาน');
    });

    it('คืนค่าข้อผิดพลาดเมื่อแท็กไม่ถูกต้อง', async () => {
      vi.spyOn(storage, 'isStorageConfigured').mockReturnValue(true);

      const formData = new FormData();
      formData.append('caseId', 'c-1');
      formData.append('tag', 'invalid-tag');
      const fakeFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
      formData.append('file', fakeFile);

      const res = await uploadResolutionPhotoAction({ error: null }, formData);
      expect(res.error).toContain('กรุณาระบุประเภทภาพถ่าย');
    });

    it('คืนค่าข้อผิดพลาดเมื่อไฟล์ไม่ใช่ภาพที่ถูกต้อง (Magic bytes ไม่ผ่าน)', async () => {
      vi.spyOn(storage, 'isStorageConfigured').mockReturnValue(true);

      const formData = new FormData();
      formData.append('caseId', 'c-1');
      formData.append('tag', 'before');
      // Create text file pretending to be image/jpeg
      const fakeFile = new File(['not a real jpeg'], 'fake.jpg', { type: 'image/jpeg' });
      formData.append('file', fakeFile);

      const res = await uploadResolutionPhotoAction({ error: null }, formData);
      expect(res.error).toContain('รองรับเฉพาะไฟล์ภาพ PNG, JPEG, WebP');
    });

    it('อัปโหลดสำเร็จเมื่อไฟล์ภาพถูกต้องและอัปเดตลง metadata ใน transaction', async () => {
      vi.spyOn(storage, 'isStorageConfigured').mockReturnValue(true);
      vi.spyOn(storage, 'uploadFile').mockResolvedValue('https://storage.local/cases/resolutions/c-1/p-1.jpg');

      // Valid JPEG header: FF D8 FF
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const validFile = new File([jpegBytes], 'photo.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('caseId', 'c-1');
      formData.append('tag', 'before');
      formData.append('caption', 'ภาพสภาพหน้างานก่อนซ่อม');
      formData.append('file', validFile);

      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: () =>
                  Promise.resolve([
                    {
                      id: 'c-1',
                      title: 'ถนนชำรุด',
                      metadata: { resolutionPhotos: [] },
                    },
                  ]),
              }),
            }),
          }),
        }),
        update: vi.fn(() => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        })),
        insert: vi.fn(() => ({
          values: () => Promise.resolve(),
        })),
      };

      vi.spyOn(dbModule, 'getDb').mockResolvedValue({
        transaction: async (cb: (tx: unknown) => unknown) => cb(mockTx),
      } as unknown as Awaited<ReturnType<typeof dbModule.getDb>>);

      const res = await uploadResolutionPhotoAction({ error: null }, formData);
      expect(res.error).toBeNull();
      expect(res.success).toContain('บันทึกภาพถ่ายผลการดำเนินงานเรียบร้อย');
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('deleteResolutionPhotoAction', () => {
    it('คืนค่าข้อผิดพลาดเมื่อไม่พบภาพถ่ายที่ต้องการลบ', async () => {
      vi.spyOn(storage, 'isStorageConfigured').mockReturnValue(true);

      const formData = new FormData();
      formData.append('caseId', 'c-1');
      formData.append('photoId', 'non-existent-photo');

      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: () =>
                  Promise.resolve([
                    {
                      id: 'c-1',
                      title: 'ถนนชำรุด',
                      metadata: { resolutionPhotos: [] },
                    },
                  ]),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(dbModule, 'getDb').mockResolvedValue({
        transaction: async (cb: (tx: unknown) => unknown) => cb(mockTx),
      } as unknown as Awaited<ReturnType<typeof dbModule.getDb>>);

      const res = await deleteResolutionPhotoAction({ error: null }, formData);
      expect(res.error).toContain('ไม่พบภาพถ่ายที่ต้องการลบ');
    });

    it('ลบภาพสำเร็จและเรียก deleteFile ใน S3', async () => {
      vi.spyOn(storage, 'isStorageConfigured').mockReturnValue(true);
      const deleteFileSpy = vi.spyOn(storage, 'deleteFile').mockResolvedValue();

      const formData = new FormData();
      formData.append('caseId', 'c-1');
      formData.append('photoId', 'photo-1');

      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: () =>
                  Promise.resolve([
                    {
                      id: 'c-1',
                      title: 'ถนนชำรุด',
                      metadata: {
                        resolutionPhotos: [
                          {
                            id: 'photo-1',
                            key: 'cases/resolutions/c-1/photo-1.jpg',
                            tag: 'before',
                            uploadedBy: 'staff-1',
                          },
                        ],
                      },
                    },
                  ]),
              }),
            }),
          }),
        }),
        update: vi.fn(() => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        })),
        insert: vi.fn(() => ({
          values: () => Promise.resolve(),
        })),
      };

      vi.spyOn(dbModule, 'getDb').mockResolvedValue({
        transaction: async (cb: (tx: unknown) => unknown) => cb(mockTx),
      } as unknown as Awaited<ReturnType<typeof dbModule.getDb>>);

      const res = await deleteResolutionPhotoAction({ error: null }, formData);
      expect(res.error).toBeNull();
      expect(res.success).toContain('ลบภาพถ่ายเรียบร้อย');
      expect(deleteFileSpy).toHaveBeenCalledWith('cases/resolutions/c-1/photo-1.jpg');
    });
  });
});
