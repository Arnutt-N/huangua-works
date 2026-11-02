import { describe, expect, it } from 'vitest';
import {
  appendResolutionPhoto,
  mergeResolutionPhotosIntoMetadata,
  parseResolutionPhotos,
  removeResolutionPhoto,
  sanitizeResolutionPhotosForCitizen,
  type ResolutionPhoto,
} from './resolution-photos';

describe('resolution-photos pure helpers', () => {
  const samplePhoto: ResolutionPhoto = {
    id: 'res-photo-1',
    key: 'cases/resolutions/case-1/photo-1.jpg',
    url: 'https://storage.local/cases/resolutions/case-1/photo-1.jpg?sig=xyz',
    tag: 'before',
    caption: 'สภาพถนนเป็นหลุมบ่อก่อนซ่อมแซม',
    size: 1024 * 500,
    type: 'image/jpeg',
    uploadedAt: '2026-11-02T10:00:00.000Z',
    uploadedBy: 'staff-uuid-1234',
  };

  const samplePhotoAfter: ResolutionPhoto = {
    id: 'res-photo-2',
    key: 'cases/resolutions/case-1/photo-2.jpg',
    url: 'https://storage.local/cases/resolutions/case-1/photo-2.jpg?sig=abc',
    tag: 'after',
    caption: 'ลงหินคลุกและเทแอสฟัลต์เรียบร้อย',
    size: 1024 * 600,
    type: 'image/jpeg',
    uploadedAt: '2026-11-02T11:00:00.000Z',
    uploadedBy: 'staff-uuid-1234',
  };

  it('parseResolutionPhotos parses valid resolutionPhotos array from metadata', () => {
    const raw = {
      lineBotContext: 'active',
      resolutionPhotos: [samplePhoto, samplePhotoAfter],
    };

    const parsed = parseResolutionPhotos(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).toBe('res-photo-1');
    expect(parsed[0]?.tag).toBe('before');
    expect(parsed[1]?.id).toBe('res-photo-2');
    expect(parsed[1]?.tag).toBe('after');
  });

  it('parseResolutionPhotos returns empty array on null, empty, or non-array metadata', () => {
    expect(parseResolutionPhotos(null)).toEqual([]);
    expect(parseResolutionPhotos(undefined)).toEqual([]);
    expect(parseResolutionPhotos({})).toEqual([]);
    expect(parseResolutionPhotos({ resolutionPhotos: 'not-an-array' })).toEqual([]);
  });

  it('sanitizeResolutionPhotosForCitizen strips uploadedBy (staff UUID) and internal S3 key', () => {
    const sanitized = sanitizeResolutionPhotosForCitizen([samplePhoto, samplePhotoAfter]);

    expect(sanitized).toHaveLength(2);
    expect(sanitized[0]).toEqual({
      id: 'res-photo-1',
      url: samplePhoto.url,
      tag: 'before',
      caption: samplePhoto.caption,
      uploadedAt: samplePhoto.uploadedAt,
    });
    // Ensure uploadedBy and key are NOT present
    expect(sanitized[0]).not.toHaveProperty('uploadedBy');
    expect(sanitized[0]).not.toHaveProperty('key');
  });

  it('sanitizeResolutionPhotosForCitizen filters out photos without signed url', () => {
    const photoWithoutUrl: ResolutionPhoto = {
      ...samplePhoto,
      id: 'no-url-id',
      url: null,
    };

    const sanitized = sanitizeResolutionPhotosForCitizen([samplePhoto, photoWithoutUrl]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.id).toBe('res-photo-1');
  });

  it('appendResolutionPhoto adds new photo to list and respects maxPhotos guard', () => {
    const initial: ResolutionPhoto[] = [samplePhoto];
    const updated = appendResolutionPhoto(initial, samplePhotoAfter);
    expect(updated).toHaveLength(2);
    expect(updated[1]?.id).toBe('res-photo-2');

    // Test max photos guard
    expect(() => appendResolutionPhoto(updated, samplePhoto, 2)).toThrow(
      /ไม่สามารถแนบภาพผลการดำเนินงานเกิน 2 ภาพได้/i,
    );
  });

  it('removeResolutionPhoto removes target photo and returns removed item', () => {
    const initial = [samplePhoto, samplePhotoAfter];
    const { updatedPhotos, removedPhoto } = removeResolutionPhoto(initial, 'res-photo-1');

    expect(updatedPhotos).toHaveLength(1);
    expect(updatedPhotos[0]?.id).toBe('res-photo-2');
    expect(removedPhoto?.id).toBe('res-photo-1');
  });

  it('removeResolutionPhoto returns removedPhoto null if id not found', () => {
    const initial = [samplePhoto];
    const { updatedPhotos, removedPhoto } = removeResolutionPhoto(initial, 'non-existent');

    expect(updatedPhotos).toHaveLength(1);
    expect(removedPhoto).toBeNull();
  });

  it('mergeResolutionPhotosIntoMetadata preserves all other fields in existing metadata', () => {
    const existing = {
      coordinates: { lat: 16.5, lng: 103.5 },
      internalNotes: 'แจ้งกำนันแล้ว',
      resolutionPhotos: [samplePhoto],
    };

    const merged = mergeResolutionPhotosIntoMetadata(existing, [samplePhoto, samplePhotoAfter]);
    expect(merged.coordinates).toEqual({ lat: 16.5, lng: 103.5 });
    expect(merged.internalNotes).toBe('แจ้งกำนันแล้ว');
    expect(merged.resolutionPhotos).toEqual([samplePhoto, samplePhotoAfter]);
  });
});
