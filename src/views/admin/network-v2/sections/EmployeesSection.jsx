import { EmployeeCodesTab } from '../tabs/EmployeeCodesTab';

/**
 * Employees section — wraps the existing EmployeeCodesTab inside the
 * Phase 5 collapsible section frame. Logic unchanged.
 */
export function EmployeesSection(props) {
  return <EmployeeCodesTab {...props} />;
}
