import { BlockingTab }     from '../tabs/BlockingTab';
import { WalledGardenTab } from '../tabs/WalledGardenTab';

/**
 * Access Section — three subsections stacked:
 *
 *   1. Free sites — pre-auth allow list (walled garden)
 *      Reuses WalledGardenTab; admins also get the polished
 *      bundle-toggle view via the existing `admin_free_sites` view.
 *   2. Blocked categories — DNS sinkhole toggles
 *      (the seeded `adult` category now ships with ~55 domains
 *      from the Phase 5 migration so toggling it actually blocks).
 *
 * Per the Phase 5 plan we fold the old `BlockingTab` + `WalledGardenTab`
 * here rather than rebuilding from scratch — they're already correct
 * and bulk-action-aware. The section provides the new visual frame.
 */
export function AccessSection({ t, user, config, toast }) {
  const tabProps = { t, user, config, toast };
  return (
    <div className="space-y-6">
      <div>
        <p className="label-eyebrow text-[var(--p-accent)] mb-2">المواقع المجانية (بدون تسجيل دخول)</p>
        <p className="text-xs text-[var(--p-fg-muted)] mb-3">
          أي زائر — حتى بدون قسيمة أو كود — يستطيع الوصول إلى هذه المواقع.
          للحصول على واجهة باقات الإكسبرس (واتساب، تيليجرام...) افتح صفحة <span className="font-bold">«المواقع المجانية»</span> من القائمة الجانبية.
        </p>
        <WalledGardenTab {...tabProps} />
      </div>

      <div className="pt-4 border-t border-[var(--p-border)]">
        <p className="label-eyebrow text-[var(--p-accent)] mb-2">الفئات المحظورة</p>
        <p className="text-xs text-[var(--p-fg-muted)] mb-3">
          تفعيل أي فئة يُدخل جميع نطاقاتها في DNS sinkhole على الراوتر.
          فئة «محتوى للبالغين» محمّلة مسبقًا بأكثر من 55 نطاقًا شائعًا.
        </p>
        <BlockingTab {...tabProps} />
      </div>
    </div>
  );
}
