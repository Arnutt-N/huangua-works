UPDATE "tier_roles" SET "roles" = (SELECT array_agg(DISTINCT x) FROM unnest("roles" || '{superadmin}') AS x), "updated_at" = now() WHERE NOT ("roles" @> '{superadmin}');
