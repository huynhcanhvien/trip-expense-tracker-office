import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

/** A real PostgreSQL (PGlite) with Supabase's roles stubbed and every migration applied. */
export async function createOfficeDb(users: string[]) {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  const migrations = new URL("../../supabase/migrations/", import.meta.url);
  for (const filename of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(filename, migrations), "utf8"));
  for (const [i, id] of users.entries())
    await db.query("insert into auth.users(id,email) values ($1,$2)", [
      id,
      `user${i}@example.test`,
    ]);

  async function asRole<T>(
    role: "authenticated" | "anon" | "service_role",
    id: string | null,
    sql: string,
    args: unknown[] = [],
  ) {
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
        id || "",
      ]);
      return tx.query<T>(sql, args);
    });
  }
  const asUser = <T>(id: string, sql: string, args: unknown[] = []) =>
    asRole<T>("authenticated", id, sql, args);
  async function call<T = unknown>(
    role: "authenticated" | "service_role",
    id: string | null,
    name: string,
    args: unknown[],
  ) {
    const params = args.map((_, i) => `$${i + 1}`).join(",");
    const result = await asRole<{ value: T }>(
      role,
      id,
      `select public.${name}(${params}) as value`,
      args,
    );
    return result.rows[0].value;
  }
  const rpc = <T = unknown>(id: string, name: string, args: unknown[] = []) =>
    call<T>("authenticated", id, name, args);
  const service = <T = unknown>(name: string, args: unknown[] = []) =>
    call<T>("service_role", null, name, args);

  /** Creates a group owned by users[0] with every other user approved. */
  async function group(currency = "VND") {
    const [owner, ...others] = users;
    const id = await rpc<string>(owner, "create_group", ["Nhóm", currency]);
    const { rows } = await asUser<{ invite_token: string }>(
      owner,
      "select invite_token from office_groups where id=$1",
      [id],
    );
    for (const user of others) {
      const request = await rpc<string>(user, "request_join", [
        rows[0].invite_token,
      ]);
      await rpc(owner, "decide_join", [request, true]);
    }
    return id;
  }
  return { db, asUser, rpc, service, group };
}
