import assert from 'node:assert/strict';

const canViewTab = (flags, roleFlags) => {
  if (flags.adminOnly && !roleFlags.isAdmin) return false;
  if (flags.employeeOnly && !roleFlags.isEmployee) return false;
  if (flags.abgeordneterOrBueroOnly && !roleFlags.isAbgeordneter && !roleFlags.isBueroleitung) return false;
  if (flags.abgeordneterOnly && !roleFlags.isAbgeordneter) return false;
  return true;
};

const flagsForRole = (role) => ({
  isAdmin: role === 'abgeordneter' || role === 'bueroleitung',
  isEmployee: ['mitarbeiter', 'praktikant', 'bueroleitung'].includes(role),
  isAbgeordneter: role === 'abgeordneter',
  isBueroleitung: role === 'bueroleitung',
});

const roles = ['abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant'];

for (const role of roles) {
  const roleFlags = flagsForRole(role);
  assert.equal(canViewTab({ abgeordneterOrBueroOnly: true }, roleFlags), role === 'abgeordneter' || role === 'bueroleitung');
  assert.equal(canViewTab({ employeeOnly: true }, roleFlags), role !== 'abgeordneter');
  assert.equal(canViewTab({}, roleFlags), true);
}

console.log('MyWork Rollen-Smoketest erfolgreich.');
