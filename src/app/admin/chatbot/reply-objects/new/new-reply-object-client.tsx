'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/page-header';
import {
  EMPTY_REPLY_OBJECT_FORM,
  ReplyObjectForm,
  type ReplyObjectFormData,
} from '../_components/reply-object-form';

export function NewReplyObjectClient() {
  const router = useRouter();
  const back = () => router.push('/admin/chatbot/reply-objects');

  async function handleSave(form: ReplyObjectFormData): Promise<boolean> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(form.payload);
    } catch {
      return false;
    }
    const res = await adminApi.createReplyObject({
      objectId: form.objectId.trim(),
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      objectType: form.objectType,
      payload,
      ...(form.altText ? { altText: form.altText } : {}),
      isActive: true,
    });
    if (!res.ok) return false;
    back();
    return true;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Template" subtitle="สร้างเทมเพลตข้อความสำหรับเรียกใช้ซ้ำ">
        <Button variant="outline" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          กลับรายการ
        </Button>
      </PageHeader>
      <div className="rounded-2xl border border-border/50 bg-surface p-6">
        <ReplyObjectForm
          initial={EMPTY_REPLY_OBJECT_FORM}
          lockObjectId={false}
          submitLabel="สร้างเทมเพลต"
          onSave={handleSave}
          onCancel={back}
        />
      </div>
    </div>
  );
}
