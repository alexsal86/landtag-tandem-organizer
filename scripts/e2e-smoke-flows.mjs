import assert from 'node:assert/strict';

const FIXTURES = Object.freeze({
  tenant: { id: 'tenant-smoke-001', name: 'Smoke Tenant' },
  users: {
    admin: { id: 'user-admin-001', email: 'admin-smoke@example.org', password: 'SmokePass!123', role: 'admin' },
    staff: { id: 'user-staff-001', email: 'staff-smoke@example.org', password: 'SmokePass!123', role: 'staff' },
  },
  appointment: {
    id: 'appointment-smoke-001',
    title: 'SMOKE_TERMIN_001',
    startsAtIso: '2030-01-15T09:00:00.000Z',
  },
  task: {
    id: 'task-smoke-001',
    title: 'SMOKE_AUFGABE_001',
    initialStatus: 'offen',
    nextStatus: 'erledigt',
  },
});

const createState = () => ({
  sessions: new Map(),
  users: new Map(Object.values(FIXTURES.users).map((u) => [u.email, u])),
  tenants: new Map([[FIXTURES.tenant.id, FIXTURES.tenant]]),
  tenantMemberships: new Map([
    [FIXTURES.users.admin.id, new Set([FIXTURES.tenant.id])],
    [FIXTURES.users.staff.id, new Set([FIXTURES.tenant.id])],
  ]),
  appointmentsByTenant: new Map(),
  tasksByTenant: new Map(),
});

const setupTenantBucket = (state, tenantId) => {
  if (!state.appointmentsByTenant.has(tenantId)) {
    state.appointmentsByTenant.set(tenantId, []);
  }
  if (!state.tasksByTenant.has(tenantId)) {
    state.tasksByTenant.set(tenantId, []);
  }
};

const clearFixtureRecords = (state) => {
  setupTenantBucket(state, FIXTURES.tenant.id);

  state.appointmentsByTenant.set(
    FIXTURES.tenant.id,
    state.appointmentsByTenant
      .get(FIXTURES.tenant.id)
      .filter((a) => a.id !== FIXTURES.appointment.id),
  );

  state.tasksByTenant.set(
    FIXTURES.tenant.id,
    state.tasksByTenant
      .get(FIXTURES.tenant.id)
      .filter((t) => t.id !== FIXTURES.task.id),
  );
};

const login = (state, email, password) => {
  const user = state.users.get(email);
  if (!user || user.password !== password) {
    throw new Error('Ungültige Login-Daten');
  }

  const sessionToken = `session-${user.id}`;
  state.sessions.set(sessionToken, { userId: user.id, tenantId: null });
  return sessionToken;
};

const selectTenant = (state, sessionToken, tenantId) => {
  const session = state.sessions.get(sessionToken);
  if (!session) throw new Error('Session nicht gefunden');

  const allowedTenants = state.tenantMemberships.get(session.userId) ?? new Set();
  if (!allowedTenants.has(tenantId) || !state.tenants.has(tenantId)) {
    throw new Error('Tenant-Auswahl nicht erlaubt');
  }

  session.tenantId = tenantId;
  setupTenantBucket(state, tenantId);
  return tenantId;
};

const requireTenant = (state, sessionToken) => {
  const session = state.sessions.get(sessionToken);
  if (!session) throw new Error('Session nicht gefunden');
  if (!session.tenantId) throw new Error('Kein Tenant gewählt');
  return { session, tenantId: session.tenantId };
};

const createAppointment = (state, sessionToken, payload) => {
  const { tenantId } = requireTenant(state, sessionToken);
  const entries = state.appointmentsByTenant.get(tenantId) ?? [];
  const withoutFixture = entries.filter((a) => a.id !== payload.id);
  const created = { ...payload, tenantId };
  state.appointmentsByTenant.set(tenantId, [...withoutFixture, created]);
  return created;
};

const listAppointments = (state, sessionToken) => {
  const { tenantId } = requireTenant(state, sessionToken);
  return state.appointmentsByTenant.get(tenantId) ?? [];
};

const createTask = (state, sessionToken, payload) => {
  const { tenantId } = requireTenant(state, sessionToken);
  const entries = state.tasksByTenant.get(tenantId) ?? [];
  const withoutFixture = entries.filter((t) => t.id !== payload.id);
  const created = { ...payload, tenantId };
  state.tasksByTenant.set(tenantId, [...withoutFixture, created]);
  return created;
};

const updateTaskStatus = (state, sessionToken, taskId, nextStatus) => {
  const { tenantId } = requireTenant(state, sessionToken);
  const tasks = state.tasksByTenant.get(tenantId) ?? [];
  const nextTasks = tasks.map((task) =>
    task.id === taskId ? { ...task, status: nextStatus } : task,
  );
  state.tasksByTenant.set(tenantId, nextTasks);
  return nextTasks.find((task) => task.id === taskId);
};

const canAccessAdminArea = (state, sessionToken) => {
  const session = state.sessions.get(sessionToken);
  if (!session) return false;
  for (const user of state.users.values()) {
    if (user.id === session.userId) {
      return user.role === 'admin';
    }
  }
  return false;
};

const run = () => {
  const state = createState();

  // Idempotentes Setup
  clearFixtureRecords(state);

  // 1) Login + Tenant-Auswahl
  const adminSession = login(state, FIXTURES.users.admin.email, FIXTURES.users.admin.password);
  const selectedTenantId = selectTenant(state, adminSession, FIXTURES.tenant.id);
  assert.equal(selectedTenantId, FIXTURES.tenant.id);

  // 2) Termin anlegen + anzeigen
  const appointment = createAppointment(state, adminSession, FIXTURES.appointment);
  assert.equal(appointment.title, FIXTURES.appointment.title);
  const appointments = listAppointments(state, adminSession);
  assert.equal(appointments.some((entry) => entry.id === FIXTURES.appointment.id), true);

  // 3) Aufgabe anlegen + Statuswechsel
  const task = createTask(state, adminSession, {
    id: FIXTURES.task.id,
    title: FIXTURES.task.title,
    status: FIXTURES.task.initialStatus,
  });
  assert.equal(task.status, FIXTURES.task.initialStatus);

  const updatedTask = updateTaskStatus(
    state,
    adminSession,
    FIXTURES.task.id,
    FIXTURES.task.nextStatus,
  );
  assert.equal(updatedTask?.status, FIXTURES.task.nextStatus);

  // 4) Rechtecheck Nicht-Admin
  const staffSession = login(state, FIXTURES.users.staff.email, FIXTURES.users.staff.password);
  selectTenant(state, staffSession, FIXTURES.tenant.id);
  assert.equal(canAccessAdminArea(state, staffSession), false);

  // Idempotentes Teardown
  clearFixtureRecords(state);

  console.log('E2E-Smoke-Flows erfolgreich.');
};

run();
