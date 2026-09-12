// Demo accounts created by `npm run seed` (and automatically in demo mode).
// The admin account comes from ADMIN_EMAIL / ADMIN_PASSWORD (see loadConfig).

export const DEMO_CUSTOMER_PASSWORD = 'customer123';
export const DEMO_TECHNICIAN_PASSWORD = 'tech1234';

export const DEMO_ACCOUNTS = [
  { role: 'customer', name: 'Nadia Khalil', email: 'nadia@example.com', phone: '+1 555 0101', password: DEMO_CUSTOMER_PASSWORD },
  { role: 'customer', name: 'Youssef Amin', email: 'youssef@example.com', phone: '+1 555 0102', password: DEMO_CUSTOMER_PASSWORD },
  { role: 'technician', name: 'Omar Haddad', email: 'omar@homefix.test', phone: '+1 555 0201', specialty: 'Plumbing', password: DEMO_TECHNICIAN_PASSWORD, status: 'active' },
  { role: 'technician', name: 'Lina Farah', email: 'lina@homefix.test', phone: '+1 555 0202', specialty: 'Electrical', password: DEMO_TECHNICIAN_PASSWORD, status: 'active' },
  { role: 'technician', name: 'Karim Nasser', email: 'karim@homefix.test', phone: '+1 555 0203', specialty: 'General maintenance', password: DEMO_TECHNICIAN_PASSWORD, status: 'active' },
  { role: 'technician', name: 'Sam Ortiz', email: 'sam@homefix.test', phone: '+1 555 0204', specialty: 'Carpentry', password: DEMO_TECHNICIAN_PASSWORD, status: 'pending' },
];

// The accounts offered on the login page in demo mode (one per role).
export function demoLogins(config) {
  return [
    { role: 'customer', email: 'nadia@example.com', password: DEMO_CUSTOMER_PASSWORD },
    { role: 'technician', email: 'omar@homefix.test', password: DEMO_TECHNICIAN_PASSWORD },
    { role: 'admin', email: config.adminEmail, password: config.adminPassword === 'admin123' ? config.adminPassword : null },
  ];
}
