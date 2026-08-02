'use client';

import { useRef, useState } from 'react';
import { Upload, Download, Image as ImageIcon } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';

const PRESETS = [
  { label: 'Rich Menu (2500x1686)', w: 2500, h: 1686 },
  { label: 'Rich Menu Half (2500x843)', w: 2500, h: 843 },
  { label: 'Image Message (1040x1040)', w: 1040, h: 1040 },
  { label: 'Square (1040x1040)', w: 1040, h: 1040 },
];

export function ImageResizeClient() {
  const [original, setOriginal] = useState<string | null>(null);
  const [resized, setResized] = useState<string | null>(null);
  const [preset, setPreset] = useState(PRESETS[0]!);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOriginal(url);
    setResized(null);
  }

  function handleResize() {
    if (!original || !canvasRef.current) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = preset.w;
      canvas.height = preset.h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, preset.w, preset.h);
      const scale = Math.min(preset.w / img.width, preset.h / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (preset.w - w) / 2, (preset.h - h) / 2, w, h);
      setResized(canvas.toDataURL('image/png'));
    };
    img.src = original;
  }

  function handleDownload() {
    if (!resized) return;
    const a = document.createElement('a');
    a.href = resized;
    a.download = `resized-${preset.w}x${preset.h}.png`;
    a.click();
  }

  async function handleUpload() {
    if (!resized) return;
    try {
      const blob = await (await fetch(resized)).blob();
      const form = new FormData();
      form.append('file', new File([blob], `resized-${preset.w}x${preset.h}.png`, { type: 'image/png' }));
      form.append('category', 'rich_menu');
      const res = await fetch('/api/line/admin/media', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'อัปโหลดไม่สำเร็จ');
      }
      notify('success', 'อัปโหลดเข้า media library สำเร็จ');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    }
  }

  return (
    <>
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}

      <AdminCard>
        <AdminCardTitle icon={<ImageIcon className="h-4 w-4" />}>ย่อรูปตาม LINE Preset</AdminCardTitle>

        <div className="space-y-4">
          <div>
            <Label>Preset ขนาด</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`min-h-touch rounded-lg border px-3 text-sm font-medium transition-colors ${
                    preset.label === p.label
                      ? 'border-accent bg-accent/10 text-accent-strong'
                      : 'border-border text-muted hover:border-accent/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="min-h-touch gap-1.5">
              <Upload className="h-4 w-4" /> เลือกรูป
            </Button>
          </div>

          {original && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted">ต้นฉบับ</p>
                <img src={original} alt="ต้นฉบับ" className="max-h-48 rounded-lg border border-border object-contain" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted">ย่อแล้ว ({preset.w}x{preset.h})</p>
                {resized ? (
                  <img src={resized} alt="ย่อแล้ว" className="max-h-48 rounded-lg border border-border object-contain" />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
                    กด "ย่อรูป" เพื่อดูผลลัพธ์
                  </div>
                )}
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {original && (
            <div className="flex gap-2">
              <Button onClick={handleResize} className="min-h-touch gap-1.5">
                <ImageIcon className="h-4 w-4" /> ย่อรูป
              </Button>
              {resized && (
                <>
                  <Button variant="outline" onClick={handleDownload} className="min-h-touch gap-1.5">
                    <Download className="h-4 w-4" /> ดาวน์โหลด
                  </Button>
                  <Button variant="outline" onClick={handleUpload} className="min-h-touch gap-1.5">
                    <Upload className="h-4 w-4" /> อัปโหลดเข้า Media
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </AdminCard>
    </>
  );
}
