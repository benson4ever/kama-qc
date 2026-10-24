/* Photos attached directly to an inspection: product reference shots (front/back)
   and packaging photos. Purely additive: new table only, no existing data touched. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    'inspection_photos',
    {
      id: { type: 'uuid', notNull: true, primaryKey: true, default: pgm.func('gen_random_uuid()') },
      inspection_id: { type: 'uuid', notNull: true, references: 'inspections', onDelete: 'CASCADE' },
      kind: { type: 'text', notNull: true, check: "kind IN ('product_front','product_back','packaging')" },
      file_path: { type: 'text', notNull: true },
      caption: { type: 'text' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true }
  );
  pgm.createIndex('inspection_photos', 'inspection_id', { ifNotExists: true });
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
