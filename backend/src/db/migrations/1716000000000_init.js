/* Initial schema for Kama QC v3. Forward-only, additive. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  const uuid = { type: 'uuid', notNull: true, default: pgm.func('gen_random_uuid()') };
  const createdAt = { type: 'timestamptz', notNull: true, default: pgm.func('now()') };

  pgm.createExtension('citext', { ifNotExists: true });

  // auto-update trigger function for updated_at
  pgm.createFunction(
    'set_updated_at',
    [],
    { returns: 'trigger', language: 'plpgsql', replace: true },
    `BEGIN NEW.updated_at = now(); RETURN NEW; END;`
  );

  // ---- users ----
  pgm.createTable('users', {
    id: { ...uuid, primaryKey: true },
    email: { type: 'citext', notNull: true, unique: true },
    name: { type: 'text' },
    name_zh: { type: 'text' },
    password_hash: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: 'staff', check: "role IN ('admin','staff')" },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: createdAt,
  });

  // ---- suppliers ----
  pgm.createTable('suppliers', {
    id: { ...uuid, primaryKey: true },
    name: { type: 'text', notNull: true, unique: true },
    name_zh: { type: 'text' },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: createdAt,
  });

  // ---- defects (standard catalogue) ----
  pgm.createTable('defects', {
    id: { ...uuid, primaryKey: true },
    code: { type: 'text', notNull: true, unique: true },
    name_en: { type: 'text', notNull: true },
    name_zh: { type: 'text' },
    classification: { type: 'text', notNull: true, check: "classification IN ('major','minor')" },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: createdAt,
  });

  // ---- pp_samples ----
  pgm.createTable('pp_samples', {
    id: { ...uuid, primaryKey: true },
    supplier_id: { type: 'uuid', notNull: true, references: 'suppliers', onDelete: 'RESTRICT' },
    po_number: { type: 'text' },
    style_id: { type: 'text' },
    fit: { type: 'text' },
    issues_text: { type: 'text' },
    result: { type: 'text', notNull: true, check: "result IN ('approved','not_approved')" },
    created_by: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    created_at: createdAt,
    updated_at: createdAt,
  });

  pgm.createTable('pp_sample_photos', {
    id: { ...uuid, primaryKey: true },
    pp_sample_id: { type: 'uuid', notNull: true, references: 'pp_samples', onDelete: 'CASCADE' },
    file_path: { type: 'text', notNull: true },
    caption: { type: 'text' },
    created_at: createdAt,
  });

  // ---- inspections ----
  pgm.createTable('inspections', {
    id: { ...uuid, primaryKey: true },
    supplier_id: { type: 'uuid', notNull: true, references: 'suppliers', onDelete: 'RESTRICT' },
    po_number: { type: 'text' },
    date_from: { type: 'date' },
    date_to: { type: 'date' },
    type: { type: 'text', notNull: true, check: "type IN ('inline','final')" },
    total_order_qty: { type: 'integer' },
    total_inspected: { type: 'integer' },
    result: { type: 'text', notNull: true, check: "result IN ('pass','fail')" },
    created_by: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    created_at: createdAt,
    updated_at: createdAt,
  });

  pgm.createTable('inspection_issues', {
    id: { ...uuid, primaryKey: true },
    inspection_id: { type: 'uuid', notNull: true, references: 'inspections', onDelete: 'CASCADE' },
    defect_id: { type: 'uuid', references: 'defects', onDelete: 'RESTRICT' },
    custom_description: { type: 'text' },
    pcs_found: { type: 'integer', notNull: true, default: 0 },
    created_at: createdAt,
  });
  // either a standard defect or a custom description must be present
  pgm.addConstraint('inspection_issues', 'inspection_issues_defect_or_custom', {
    check: 'defect_id IS NOT NULL OR custom_description IS NOT NULL',
  });

  pgm.createTable('inspection_issue_photos', {
    id: { ...uuid, primaryKey: true },
    inspection_issue_id: { type: 'uuid', notNull: true, references: 'inspection_issues', onDelete: 'CASCADE' },
    file_path: { type: 'text', notNull: true },
    caption: { type: 'text' },
    created_at: createdAt,
  });

  // ---- updated_at triggers ----
  for (const t of ['pp_samples', 'inspections']) {
    pgm.createTrigger(t, `${t}_set_updated_at`, {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'set_updated_at',
    });
  }

  // ---- helpful indexes ----
  pgm.createIndex('pp_samples', 'supplier_id');
  pgm.createIndex('pp_samples', 'created_at');
  pgm.createIndex('inspections', 'supplier_id');
  pgm.createIndex('inspections', 'created_at');
  pgm.createIndex('inspection_issues', 'inspection_id');
  pgm.createIndex('inspection_issues', 'defect_id');
  pgm.createIndex('pp_sample_photos', 'pp_sample_id');
  pgm.createIndex('inspection_issue_photos', 'inspection_issue_id');
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
