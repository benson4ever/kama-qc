/* Add a free-text comment field to PP samples and factory inspections.
   Purely additive: new nullable column, existing rows get NULL. No data is removed. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('pp_samples', { comment: { type: 'text' } }, { ifNotExists: true });
  pgm.addColumns('inspections', { comment: { type: 'text' } }, { ifNotExists: true });
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
