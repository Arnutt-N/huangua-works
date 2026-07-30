'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { initialsOf, type UserRole } from '@/components/admin/admin-nav';
import { RoleBadge } from '@/components/admin/role-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * UserMenu — เมนูตัวตนผู้ใช้ที่มุมขวาบนของ topbar
 *
 * § ทำไมรวมไว้ที่นี่แทนท้าย sidebar
 * เดิม "โปรไฟล์ของฉัน" + "ออกจากระบบ" กินพื้นที่ตายตัวท้าย sidebar ทั้งที่เป็นการ
 * สั่งงานนาน ๆ ครั้ง ไม่ใช่การนำทาง — ย้ายมารวมเป็น dropdown ของ avatar ทำให้ sidebar
 * เหลือเฉพาะเมนูงาน และตัวตนผู้ใช้ (ชื่อ/บทบาท) แสดงอยู่ที่เดียวกับที่กดสั่งงาน
 *
 * § ปุ่ม logout ใน dropdown ไม่ได้ submit ทันที — เปิด Dialog ยืนยันก่อน
 * กันการกดพลาด (ออกแล้วต้อง login ใหม่) ใช้ state คุมเปิด/ปิดแทนการซ้อน
 * DialogTrigger ใน MenuItem เพราะ Radix ปิด menu แล้ว dialog ไม่ทันเปิด
 */
export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: UserRole;
}) {
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, startLogout] = useTransition();

  // § ปิด Dialog ก่อน navigate — logout() เป็น server action ที่ redirect ทำให้ทั้ง
  // layout (รวม Dialog) unmount ระหว่างที่ Dialog ยัง open; Radix จึงไม่ทันคืนค่า
  // pointer-events บน <body> → หน้า login คลิก input ไม่ได้จนกว่าจะ hard reload
  // การ setState(false) ก่อน แล้วค่อยยิง action (มี round-trip) ให้ React unmount
  // Dialog + คืน pointer-events เสร็จก่อน redirect จะมาถึงเสมอ
  function handleConfirmLogout() {
    setConfirmLogoutOpen(false);
    startLogout(async () => {
      await logout();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="เมนูผู้ใช้"
          className="flex flex-none items-center gap-2 rounded-pill p-1 pr-2 outline-none transition-colors duration-fast hover:bg-accent-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong data-[state=open]:bg-accent-sunken"
        >
          <span className="hidden text-right sm:block">
            <span className="block max-w-[12rem] truncate text-sm font-semibold text-ink">
              {fullName}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="bg-accent-gradient-br flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold text-on-accent"
          >
            {initialsOf(fullName)}
          </span>
          <ChevronDown className="hidden h-4 w-4 flex-none text-muted sm:block" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-64">
          {/* หัวเมนู: ตัวตน + บทบาท — badge บทบาทอยู่ที่นี่ที่เดียว ไม่ซ้ำบน topbar */}
          <DropdownMenuLabel className="py-2.5">
            <span className="block truncate font-bold">{fullName}</span>
            <span className="block truncate text-xs font-normal text-muted">{email}</span>
            <RoleBadge role={role} className="mt-2" />
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/admin/profile">
              <UserCircle className="h-5 w-5 flex-none text-muted" aria-hidden="true" />
              โปรไฟล์ของฉัน
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => setConfirmLogoutOpen(true)}
            className="text-danger-ink data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger-ink"
          >
            <LogOut className="h-5 w-5 flex-none" aria-hidden="true" />
            ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ยืนยันก่อนออกจริง — ยกเลิกได้เสมอ (default action = ไม่ออก) */}
      <Dialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ออกจากระบบ</DialogTitle>
            <DialogDescription>คุณต้องการออกจากระบบจริงๆ ใช่ไหม?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmLogout}
              disabled={loggingOut}
            >
              ออกจากระบบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
