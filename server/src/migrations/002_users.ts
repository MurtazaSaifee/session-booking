import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.text("role").notNullable().checkIn(["MEMBER", "PROFESSIONAL"]);
    table.text("name").notNullable();
    table.text("email").notNullable();
    table.text("password_hash").notNullable();
    table.text("timezone").notNullable();
    table.text("title");
    table.text("bio");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.raw("now()"));
  });
  await knex.raw("create unique index users_email_key on users (lower(email))");

  await knex.schema.createTable("refresh_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").notNullable();
    table.foreign("user_id", "refresh_tokens_user_id_fkey").references("id").inTable("users").onDelete("CASCADE");
    table.text("token_hash").notNullable().unique("refresh_tokens_token_hash_key");
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.raw("now()"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("refresh_tokens");
  await knex.schema.dropTable("users");
}
