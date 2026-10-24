/* Optional severity for custom (free-text) inspection issues. Standard defects
   keep their catalogue classification; custom issues may now be marked major or
   minor, or left NULL = "other". Purely additive: one nullable column. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns(
    'inspection_issues',
    { classification: { type: 'text', check: "classification IN ('major','minor')" } },
    { ifNotExists: true }
  );
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
