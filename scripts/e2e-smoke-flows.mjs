import assert from 'node:assert/strict';

const DEFAULT_RETRY_COUNT = Number.parseInt(process.env.E2E_SMOKE_RETRIES ?? '2', 10);
const requestedSuite = process.env.E2E_SMOKE_SUITE ?? 'extended';

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

const clearFixtureRecords = (state, fixtures = FIXTURES) => {
  setupTenantBucket(state, fixtures.tenant.id);

  state.appointmentsByTenant.set(
    fixtures.tenant.id,
    state.appointmentsByTenant
      .get(fixtures.tenant.id)
      .filter((a) => a.id !== fixtures.appointment.id),
  );

  state.tasksByTenant.set(
    fixtures.tenant.id,
    state.tasksByTenant
      .get(fixtures.tenant.id)
      .filter((t) => t.id !== fixtures.task.id),
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

  const runtimeFixtureNamespace = process.env.GITHUB_RUN_ID ?? 'local';
  const deterministicFixtures = {
    ...FIXTURES,
    appointment: {
      ...FIXTURES.appointment,
      id: `${FIXTURES.appointment.id}-${runtimeFixtureNamespace}`,
      title: `${FIXTURES.appointment.title}-${runtimeFixtureNamespace}`,
    },
    task: {
      ...FIXTURES.task,
      id: `${FIXTURES.task.id}-${runtimeFixtureNamespace}`,
      title: `${FIXTURES.task.title}-${runtimeFixtureNamespace}`,
    },
  };

  const flowContext = { state, fixtures: deterministicFixtures };

  const retryFlow = (name, flow) => {
    for (let attempt = 1; attempt <= DEFAULT_RETRY_COUNT + 1; attempt += 1) {
      try {
        flow();
        console.log(`✅ ${name} erfolgreich (Versuch ${attempt}/${DEFAULT_RETRY_COUNT + 1})`);
        return;
      } catch (error) {
        const isLastAttempt = attempt > DEFAULT_RETRY_COUNT;
        console.error(`⚠️ ${name} fehlgeschlagen (Versuch ${attempt}/${DEFAULT_RETRY_COUNT + 1}): ${error.message}`);
        if (isLastAttempt) {
          throw error;
        }
      }
    }
  };

  const flows = {
    loginAndTenantSelection: () => {
      clearFixtureRecords(state, deterministicFixtures);
      const adminSession = login(state, deterministicFixtures.users.admin.email, deterministicFixtures.users.admin.password);
      flowContext.adminSession = adminSession;
      const selectedTenantId = selectTenant(state, adminSession, deterministicFixtures.tenant.id);
      assert.equal(selectedTenantId, deterministicFixtures.tenant.id, 'Admin-Tenant muss auswählbar sein.');
    },
    appointmentLifecycle: () => {
      const appointment = createAppointment(state, flowContext.adminSession, deterministicFixtures.appointment);
      assert.equal(appointment.title, deterministicFixtures.appointment.title, 'Termin-Titel muss korrekt gespeichert werden.');
      const appointments = listAppointments(state, flowContext.adminSession);
      assert.equal(
        appointments.some((entry) => entry.id === deterministicFixtures.appointment.id),
        true,
        'Neu angelegter Termin muss in der Liste erscheinen.',
      );
    },
    taskLifecycle: () => {
      const task = createTask(state, flowContext.adminSession, {
        id: deterministicFixtures.task.id,
        title: deterministicFixtures.task.title,
        status: deterministicFixtures.task.initialStatus,
      });
      assert.equal(task.status, deterministicFixtures.task.initialStatus, 'Neue Aufgabe muss im initialen Status starten.');

      const updatedTask = updateTaskStatus(
        state,
        flowContext.adminSession,
        deterministicFixtures.task.id,
        deterministicFixtures.task.nextStatus,
      );
      assert.equal(updatedTask?.status, deterministicFixtures.task.nextStatus, 'Aufgaben-Statuswechsel muss persistiert sein.');
    },
    nonAdminAuthorization: () => {
      const staffSession = login(state, deterministicFixtures.users.staff.email, deterministicFixtures.users.staff.password);
      selectTenant(state, staffSession, deterministicFixtures.tenant.id);
      assert.equal(canAccessAdminArea(state, staffSession), false, 'Nicht-Admin darf keinen Zugriff auf den Admin-Bereich erhalten.');
    },
  };

  const smokeRequiredFlowOrder = ['loginAndTenantSelection', 'appointmentLifecycle', 'taskLifecycle'];
  const smokeExtendedFlowOrder = [...smokeRequiredFlowOrder, 'nonAdminAuthorization'];
  const selectedFlowOrder = requestedSuite === 'required' ? smokeRequiredFlowOrder : smokeExtendedFlowOrder;

  for (const flowName of selectedFlowOrder) {
    retryFlow(flowName, flows[flowName]);
  }

  clearFixtureRecords(state, deterministicFixtures);
  console.log(`E2E-Smoke-Flows erfolgreich (Suite: ${requestedSuite}).`);
};

run();
