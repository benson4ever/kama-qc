/* Reinspections: a failed inspection or PP sample can be re-checked by a new
   entry that points at its predecessor via reinspection_of, forming a chain.
   Also widens inspection photo kinds with 'measurement' (measurement charts).
   Purely additive: new nullable columns and a relaxed check constraint. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns(
    'inspections',
    { reinspection_of: { type: 'uuid', references: 'inspections', onDelete: 'SET NULL' } },
    { ifNotExists: true }
  );
  pgm.createIndex('inspections', 'reinspection_of', { ifNotExists: true });

  pgm.addColumns(
    'pp_samples',
    { reinspection_of: { type: 'uuid', references: 'pp_samples', onDelete: 'SET NULL' } },
    { ifNotExists: true }
  );
  pgm.createIndex('pp_samples', 'reinspection_of', { ifNotExists: true });

  pgm.dropConstraint('inspection_photos', 'inspection_photos_kind_check', { ifExists: true });
  pgm.addConstraint('inspection_photos', 'inspection_photos_kind_check', {
    check: "kind IN ('product_front','product_back','packaging','measurement')",
  });
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
