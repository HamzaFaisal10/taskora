/**
 * Database tests: applies every migration to a throwaway local Postgres and
 * checks the rules that keep workspaces private, the plan limits, the RPCs and
 * the demo reset.
 *
 *   npm run db:start   # starts a local Postgres on port 54329 (once)
 *   npm run db:test
 *
 * Override the server with TEST_DATABASE_ADMIN_URL (must be a superuser URL
 * pointing at the "postgres" database). Never point it at Supabase.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Client } from "pg";

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";
const DB_NAME = "taskora_test";
const ROOT = join(import.meta.dirname, "..");

type Who = "anon" | "service" | string; // a user id means "signed in as that user"

let db: Client;
let passed = 0;
const failures: string[] = [];

async function setup() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB_NAME} with (force)`);
  await admin.query(`create database ${DB_NAME}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB_NAME}`;
  db = new Client({ connectionString: url.toString() });
  await db.connect();

  await db.query(readFileSync(join(ROOT, "supabase/tests/supabase-stub.sql"), "utf8"));
  const dir = join(ROOT, "supabase/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      await db.query(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
}

/** Run `fn` inside a transaction as the given role, then roll everything back. */
async function as<T>(who: Who, fn: () => Promise<T>, { keep = false } = {}): Promise<T> {
  await db.query("begin");
  try {
    if (who === "anon") {
      await db.query("set local role anon");
      await db.query("select set_config('request.jwt.claim.sub', '', true)");
    } else if (who === "service") {
      await db.query("set local role service_role");
    } else {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [who]);
    }
    const result = await fn();
    await db.query(keep ? "commit" : "rollback");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function q<R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> {
  return (await db.query(sql, params)).rows as R[];
}

async function one<R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R> {
  const rows = await q<R>(sql, params);
  assert.equal(rows.length, 1, `expected one row from: ${sql}`);
  return rows[0];
}

async function rejects(promise: Promise<unknown>, match: RegExp) {
  try {
    await promise;
  } catch (error) {
    const message = `${(error as Error).message} ${(error as { hint?: string }).hint ?? ""}`;
    assert.match(message, match);
    return;
  }
  assert.fail(`expected an error matching ${match}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${(error as Error).message.split("\n").join("\n      ")}`);
    // make sure a failed test never leaves a transaction open
    await db.query("rollback").catch(() => {});
  }
}

async function createAuthUser(email: string, name: string): Promise<string> {
  const row = await one<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id",
    [email, name],
  );
  return row.id;
}

async function main() {
  console.log("Setting up a fresh database…");
  await setup();

  const owner = await createAuthUser("demo@taskora.example", "Demo");
  const outsider = await createAuthUser("sam@outside.example", "Sam Outsider");
  const SARA = "00000000-0000-4000-8000-00000000a001";
  const ZAIN = "00000000-0000-4000-8000-00000000a002";
  const LENA = "00000000-0000-4000-8000-00000000a008";

  const demoWs = await as(
    "service",
    async () => (await one<{ id: string }>("select public.reset_demo() as id")).id,
    {
      keep: true,
    },
  );

  const projectId = async (key: string) =>
    (
      await one<{ id: string }>(
        "select id from public.projects where key = $1 and workspace_id = $2",
        [key, demoWs],
      )
    ).id;
  const MOB = await projectId("MOB");
  const CUS = await projectId("CUS");

  console.log("\nDemo workspace");

  await test("reset_demo builds the whole workspace", async () => {
    const counts = await one<Record<string, number>>(
      `select
         (select count(*)::int from public.projects where workspace_id = $1) as projects,
         (select count(*)::int from public.workspace_members where workspace_id = $1) as members,
         (select count(*)::int from public.tasks where workspace_id = $1) as tasks,
         (select count(*)::int from public.tasks where workspace_id = $1 and completed_at is not null) as done,
         (select count(*)::int from public.sprints s join public.projects p on p.id = s.project_id where p.workspace_id = $1) as sprints,
         (select count(*)::int from public.notifications where workspace_id = $1 and read_at is null) as unread`,
      [demoWs],
    );
    assert.equal(counts.projects, 4);
    assert.equal(counts.members, 9);
    assert.ok(counts.tasks > 230, `tasks: ${counts.tasks}`);
    assert.ok(counts.done > 160, `done: ${counts.done}`);
    assert.equal(counts.sprints, 3);
    assert.equal(counts.unread, 5);
  });

  await test("demo dates are relative to today", async () => {
    const stripe = await one<{ due: string; ref: string }>(
      `select t.due_date = current_date as due, p.key || '-' || t.number as ref
       from public.tasks t join public.projects p on p.id = t.project_id
       where t.title = 'Set up Stripe subscriptions & webhooks' and t.workspace_id = $1`,
      [demoWs],
    );
    assert.equal(stripe.due, true);
    assert.match(stripe.ref, /^MOB-1\d\d$/);
    const active = await one<{ ok: boolean }>(
      "select current_date between start_date and end_date as ok from public.sprints where project_id = $1 and state = 'active'",
      [MOB],
    );
    assert.equal(active.ok, true);
  });

  await test("reset_demo can run again and gives the same workspace", async () => {
    await as("service", async () => {
      const before = await one<{ n: number }>(
        "select count(*)::int as n from public.tasks where workspace_id = $1",
        [demoWs],
      );
      const again = (await one<{ id: string }>("select public.reset_demo() as id")).id;
      const after = await one<{ n: number }>(
        "select count(*)::int as n from public.tasks where workspace_id = $1",
        [again],
      );
      assert.equal(after.n, before.n);
      const demos = await one<{ n: number }>(
        "select count(*)::int as n from public.workspaces where is_demo",
      );
      assert.equal(demos.n, 1);
    });
  });

  await test("only the server can reset the demo", async () => {
    await rejects(
      as(owner, () => q("select public.reset_demo()")),
      /permission denied/,
    );
    await rejects(
      as("anon", () => q("select public.reset_demo()")),
      /permission denied/,
    );
  });

  console.log("\nPrivacy between workspaces");

  await test("members see their workspace", async () => {
    await as(owner, async () => {
      assert.equal((await q("select 1 from public.projects")).length, 4);
      assert.ok((await q("select 1 from public.tasks")).length > 230);
      assert.equal((await q("select 1 from public.profiles")).length, 9);
    });
  });

  await test("outsiders see nothing from another workspace", async () => {
    await as(outsider, async () => {
      assert.equal((await q("select 1 from public.workspaces")).length, 0);
      assert.equal((await q("select 1 from public.projects")).length, 0);
      assert.equal((await q("select 1 from public.tasks")).length, 0);
      assert.equal((await q("select 1 from public.comments")).length, 0);
      assert.equal((await q("select 1 from public.notifications")).length, 0);
      const profiles = await q<{ id: string }>("select id from public.profiles");
      assert.deepEqual(
        profiles.map((p) => p.id),
        [outsider],
      );
    });
  });

  await test("outsiders cannot write into another workspace", async () => {
    await rejects(
      as(outsider, () =>
        q("insert into public.tasks (project_id, title) values ($1, 'sneaky')", [MOB]),
      ),
      /row-level security/,
    );
    await as(outsider, async () => {
      const res = await db.query("update public.tasks set title = 'hacked' where project_id = $1", [
        MOB,
      ]);
      assert.equal(res.rowCount, 0);
    });
  });

  await test("anonymous visitors cannot read tables", async () => {
    await rejects(
      as("anon", () => q("select * from public.tasks")),
      /permission denied/,
    );
    await rejects(
      as("anon", () => q("select * from public.profiles")),
      /permission denied/,
    );
  });

  await test("each person only sees their own inbox", async () => {
    await as(SARA, async () => {
      const rows = await q<{ user_id: string }>("select user_id from public.notifications");
      assert.ok(rows.every((r) => r.user_id === SARA));
    });
  });

  console.log("\nRoles");

  await test("guests only see the projects shared with them", async () => {
    await as(LENA, async () => {
      const projects = await q<{ key: string }>("select key from public.projects");
      assert.deepEqual(
        projects.map((p) => p.key),
        ["CUS"],
      );
      const tasks = await q<{ project_id: string }>("select project_id from public.tasks");
      assert.ok(tasks.length > 0 && tasks.every((t) => t.project_id === CUS));
      assert.equal((await q("select 1 from public.goals")).length, 0);
    });
  });

  await test("guests can comment but not create tasks", async () => {
    await as(LENA, async () => {
      const task = await one<{ id: string }>(
        "select id from public.tasks where project_id = $1 limit 1",
        [CUS],
      );
      await q(
        "insert into public.comments (task_id, author_id, body) values ($1, $2, 'Looks good')",
        [task.id, LENA],
      );
    });
    await rejects(
      as(LENA, () =>
        q("insert into public.tasks (project_id, title) values ($1, 'New task')", [CUS]),
      ),
      /row-level security/,
    );
  });

  await test("members cannot change billing or plan fields", async () => {
    await rejects(
      as(ZAIN, () => q("update public.workspaces set plan = 'business'")),
      /permission denied/,
    );
    await rejects(
      as(owner, () => q("update public.workspaces set ai_credits_used = 0")),
      /permission denied/,
    );
  });

  await test("only admins manage members, and nobody can make a second owner", async () => {
    await as(
      outsider,
      async () => {
        await q("select public.create_workspace('Sam Co', 'sam-co')");
      },
      { keep: true },
    );
    const samWs = (
      await one<{ id: string }>("select id from public.workspaces where slug = 'sam-co'")
    ).id;
    await rejects(
      as(ZAIN, () =>
        q(
          "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')",
          [demoWs, outsider],
        ),
      ),
      /row-level security/,
    );
    await rejects(
      as(owner, () =>
        q(
          "update public.workspace_members set role = 'owner' where user_id = $1 and workspace_id = $2",
          [ZAIN, demoWs],
        ),
      ),
      /row-level security/,
    );
    await as(owner, async () => {
      await q(
        "update public.workspace_members set role = 'admin' where user_id = $1 and workspace_id = $2",
        [ZAIN, demoWs],
      );
    });
    await db.query("delete from public.workspaces where id = $1", [samWs]);
  });

  console.log("\nTasks");

  await test("new tasks get the next number, a default status and an activity entry", async () => {
    await as(ZAIN, async () => {
      const max = await one<{ n: number }>(
        "select max(number)::int as n from public.tasks where project_id = $1",
        [MOB],
      );
      const task = await one<{ id: string; number: number; creator_id: string; category: string }>(
        `with t as (insert into public.tasks (project_id, title, assignee_id) values ($1, 'Write release notes', $2) returning *)
         select t.id, t.number, t.creator_id, s.category from t join public.task_statuses s on s.id = t.status_id`,
        [MOB, SARA],
      );
      assert.equal(task.number, max.n + 1);
      assert.equal(task.creator_id, ZAIN);
      assert.equal(task.category, "unstarted");
      const activity = await q(
        "select 1 from public.activity where task_id = $1 and action = 'created'",
        [task.id],
      );
      assert.equal(activity.length, 1);
    });
  });

  await test("assigning someone sends them a notification", async () => {
    // Zain assigns Sara; the notification belongs to Sara, so inspect it as the server.
    await as("service", async () => {
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ZAIN]);
      await q(
        "insert into public.tasks (project_id, title, assignee_id) values ($1, 'Check analytics', $2)",
        [MOB, SARA],
      );
      const n = await q(
        "select 1 from public.notifications where user_id = $1 and kind = 'assigned' and title like '%Check analytics'",
        [SARA],
      );
      assert.equal(n.length, 1);
    });
  });

  await test("move_task places a card between its neighbours", async () => {
    await as(ZAIN, async () => {
      const review = (
        await one<{ id: string }>(
          "select id from public.task_statuses where project_id = $1 and category = 'review'",
          [MOB],
        )
      ).id;
      const cards = await q<{ id: string; position: number }>(
        "select id, position from public.tasks where status_id = $1 order by position limit 2",
        [review],
      );
      const mover = await one<{ id: string }>(
        "select id from public.tasks where project_id = $1 and parent_id is null and status_id <> $2 limit 1",
        [MOB, review],
      );
      if (cards.length === 1) {
        await q("select public.move_task($1, $2, $3, null)", [mover.id, review, cards[0].id]);
      } else {
        const pos = await one<{ p: number }>("select public.move_task($1, $2, $3, $4) as p", [
          mover.id,
          review,
          cards[0].id,
          cards[1].id,
        ]);
        assert.ok(pos.p > cards[0].position && pos.p < cards[1].position);
      }
      const moved = await one<{ status_id: string }>(
        "select status_id from public.tasks where id = $1",
        [mover.id],
      );
      assert.equal(moved.status_id, review);
    });
  });

  await test("tasks stay inside their project", async () => {
    const web = await projectId("WEB");
    await rejects(
      as(ZAIN, async () => {
        const otherStatus = (
          await one<{ id: string }>(
            "select id from public.task_statuses where project_id = $1 limit 1",
            [web],
          )
        ).id;
        await q(
          "insert into public.tasks (project_id, title, status_id) values ($1, 'Wrong status', $2)",
          [MOB, otherStatus],
        );
      }),
      /Status does not belong/,
    );
  });

  await test("dependencies cannot loop", async () => {
    await rejects(
      as(ZAIN, async () => {
        const dep = await one<{ task_id: string; blocked_by_id: string }>(
          "select d.task_id, d.blocked_by_id from public.task_dependencies d join public.tasks t on t.id = d.task_id where t.project_id = $1 limit 1",
          [MOB],
        );
        await q("insert into public.task_dependencies (task_id, blocked_by_id) values ($1, $2)", [
          dep.blocked_by_id,
          dep.task_id,
        ]);
      }),
      /already block each other/,
    );
  });

  await test("one running timer per person", async () => {
    await rejects(
      as(owner, async () => {
        const task = await one<{ id: string }>(
          "select id from public.tasks where project_id = $1 limit 1",
          [MOB],
        );
        // The first timer starts fine; a second one while it runs is refused.
        await q("insert into public.time_entries (task_id, user_id) values ($1, $2)", [
          task.id,
          owner,
        ]);
        await q("insert into public.time_entries (task_id, user_id) values ($1, $2)", [
          task.id,
          owner,
        ]);
      }),
      /time_entries_one_running_idx/,
    );
  });

  console.log("\nAutomations");

  const statusOf = async (project: string, category: string) =>
    (
      await one<{ id: string }>(
        "select id from public.task_statuses where project_id = $1 and category = $2 order by position limit 1",
        [project, category],
      )
    ).id;

  await test("moving a task to Review runs the matching rule", async () => {
    await as(ZAIN, async () => {
      const task = await one<{ id: string }>(
        "insert into public.tasks (project_id, title, assignee_id) values ($1, 'Polish settings screen', $2) returning id",
        [MOB, ZAIN],
      );
      await q("update public.tasks set status_id = $2 where id = $1", [
        task.id,
        await statusOf(MOB, "review"),
      ]);
      const after = await one<{ assignee_id: string }>(
        "select assignee_id from public.tasks where id = $1",
        [task.id],
      );
      assert.equal(after.assignee_id, SARA, "the Review rule assigns Sara");
      const ran = await q(
        "select 1 from public.activity where task_id = $1 and action = 'automation_ran'",
        [task.id],
      );
      assert.equal(ran.length, 1);
    });
  });

  await test("completing a task completes its subtasks", async () => {
    await as(ZAIN, async () => {
      const parent = await one<{ id: string }>(
        "insert into public.tasks (project_id, title) values ($1, 'Ship release 2.1') returning id",
        [MOB],
      );
      await q(
        "insert into public.tasks (project_id, title, parent_id) values ($1, 'Write changelog', $2), ($1, 'Tag build', $2)",
        [MOB, parent.id],
      );
      await q("update public.tasks set status_id = $2 where id = $1", [
        parent.id,
        await statusOf(MOB, "completed"),
      ]);
      const open = await q(
        `select 1 from public.tasks t join public.task_statuses s on s.id = t.status_id
         where t.parent_id = $1 and s.category <> 'completed'`,
        [parent.id],
      );
      assert.equal(open.length, 0);
    });
  });

  await test("disabled rules and other projects are left alone", async () => {
    await as(ZAIN, async () => {
      const web = await projectId("WEB");
      const task = await one<{ id: string }>(
        "insert into public.tasks (project_id, title, assignee_id) values ($1, 'Footer links', $2) returning id",
        [web, ZAIN],
      );
      await q("update public.tasks set status_id = $2 where id = $1", [
        task.id,
        await statusOf(web, "review"),
      ]);
      const after = await one<{ assignee_id: string }>(
        "select assignee_id from public.tasks where id = $1",
        [task.id],
      );
      assert.equal(after.assignee_id, ZAIN);
    });
  });

  await test("a rule that moves a task cannot trigger itself in a loop", async () => {
    await as(owner, async () => {
      await q(
        `insert into public.automations (project_id, name, trigger, actions)
         values ($1, 'Bounce', '{"type": "status_changed", "to_category": "started"}', '[{"type": "move_to_category", "category": "review"}]'),
                ($1, 'Bounce back', '{"type": "status_changed", "to_category": "review"}', '[{"type": "move_to_category", "category": "started"}]')`,
        [MOB],
      );
      const task = await one<{ id: string }>(
        "insert into public.tasks (project_id, title) values ($1, 'Loop check') returning id",
        [MOB],
      );
      await q("update public.tasks set status_id = $2 where id = $1", [
        task.id,
        await statusOf(MOB, "started"),
      ]);
      const after = await one<{ category: string }>(
        "select s.category from public.tasks t join public.task_statuses s on s.id = t.status_id where t.id = $1",
        [task.id],
      );
      assert.equal(after.category, "review");
    });
  });

  await test("scheduled rules raise priority on tasks due tomorrow, once", async () => {
    await as("service", async () => {
      const task = await one<{ id: string }>(
        "insert into public.tasks (project_id, title, priority, due_date) values ($1, 'Renew certificates', 'low', current_date + 1) returning id",
        [MOB],
      );
      const first = await one<{ n: number }>("select public.run_scheduled_automations() as n");
      assert.ok(first.n >= 1);
      const after = await one<{ priority: string }>(
        "select priority from public.tasks where id = $1",
        [task.id],
      );
      assert.equal(after.priority, "high");
      await q("select public.run_scheduled_automations()");
      const runs = await q(
        "select 1 from public.activity where task_id = $1 and action = 'automation_ran'",
        [task.id],
      );
      assert.equal(runs.length, 1);
    });
  });

  await test("only the server runs scheduled rules", async () => {
    await as(ZAIN, async () => {
      await rejects(q("select public.run_scheduled_automations()"), /permission denied/);
    });
  });

  console.log("\nPlans & billing");

  await test("Free workspaces stop at 3 projects", async () => {
    await as(outsider, async () => {
      const ws = await one<{ id: string }>(
        "select (public.create_workspace('Free Co', 'free-co')).id as id",
      );
      for (const key of ["AAA", "BBB", "CCC"]) {
        await q(
          "insert into public.projects (workspace_id, key, name, created_by) values ($1, $2, $2, $3)",
          [ws.id, key, outsider],
        );
      }
      await rejects(
        q(
          "insert into public.projects (workspace_id, key, name, created_by) values ($1, 'DDD', 'DDD', $2)",
          [ws.id, outsider],
        ),
        /PLAN_LIMIT_PROJECTS/,
      );
    });
  });

  await test("reserved workspace URLs are refused", async () => {
    await rejects(
      as(outsider, () => q("select public.create_workspace('Demo', 'demo')")),
      /SLUG_TAKEN/,
    );
  });

  await test("AI credits are counted per workspace", async () => {
    await as(owner, async () => {
      const left = await one<{ n: number }>("select public.use_ai_credits($1, 1) as n", [demoWs]);
      assert.equal(left.n, 200 - 73);
    });
    await rejects(
      as(LENA, () => q("select public.use_ai_credits($1, 1)", [demoWs])),
      /Not allowed/,
    );
  });

  console.log("\nPublic forms");

  await test("anyone can open a public form", async () => {
    await as("anon", async () => {
      const form = await one<{ f: { title: string; workspace: string } }>(
        "select public.get_public_form('demo-bug-report') as f",
      );
      assert.equal(form.f.title, "Report a bug");
      assert.equal(form.f.workspace, "Halcyon Labs");
    });
  });

  await test("submitting a form creates a triage task", async () => {
    await as("anon", async () => {
      const ref = await one<{ ref: string }>(
        `select public.submit_form('demo-bug-report', '{"q1": "Export button does nothing", "q3": "High", "q4": "kim@client.example"}') as ref`,
      );
      assert.match(ref.ref, /^CUS-\d+$/);
    });
    await as("service", async () => {
      await db.query("set local role anon");
      await q(
        `select public.submit_form('demo-bug-report', '{"q1": "Export button does nothing", "q3": "High", "q4": "kim@client.example"}')`,
      );
      await db.query("reset role");
      const task = await one<{ category: string; priority: string; source: string }>(
        `select s.category, t.priority, t.source from public.tasks t join public.task_statuses s on s.id = t.status_id
         where t.title = 'Export button does nothing'`,
      );
      assert.deepEqual(task, { category: "triage", priority: "high", source: "form" });
    });
  });

  await test("forms check required fields and emails", async () => {
    await rejects(
      as("anon", () => q(`select public.submit_form('demo-bug-report', '{"q1": "No email"}')`)),
      /FORM_FIELD_REQUIRED/,
    );
    await rejects(
      as("anon", () =>
        q(
          `select public.submit_form('demo-bug-report', '{"q1": "Bad email", "q4": "not-an-email"}')`,
        ),
      ),
      /FORM_EMAIL_INVALID/,
    );
  });

  await db.end();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await db?.end().catch(() => {});
  process.exit(1);
});
