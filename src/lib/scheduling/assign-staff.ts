export type StaffLoad = { staffId: string; appointmentCount: number };

export function orderStaffByLoad(staff: StaffLoad[]) {
  return [...staff].sort((a, b) => a.appointmentCount - b.appointmentCount || a.staffId.localeCompare(b.staffId));
}

export function chooseLeastBookedStaff(staff: StaffLoad[]) {
  return orderStaffByLoad(staff)[0]?.staffId;
}
