import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("create extension if not exists btree_gist");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("drop extension if exists btree_gist");
}
