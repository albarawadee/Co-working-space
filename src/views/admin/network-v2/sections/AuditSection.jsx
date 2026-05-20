import { AuditTab } from '../tabs/AuditTab';

/**
 * Audit section — wraps the existing AuditTab inside the Phase 5
 * collapsible section frame. The tab logic is unchanged; only the
 * surrounding container changed.
 */
export function AuditSection({ t, user, config, eventsDb, toast }) {
  return <AuditTab t={t} user={user} config={config} eventsDb={eventsDb} toast={toast} />;
}
