/* Every logged issue must carry a severity so that major % + minor % always
   equals total defect %. Custom ("other") issues recorded before this change
   with no severity are classified as minor; from here on the QC inspector
   picks major or minor for each custom issue (enforced in the UI, the API
   and by this check constraint). Additive: a data backfill plus a constraint. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`UPDATE inspection_issues SET classification = 'minor'
           WHERE defect_id IS NULL AND classification IS NULL`);
  pgm.addConstraint('inspection_issues', 'inspection_issues_custom_needs_classification', {
    check: 'defect_id IS NOT NULL OR classification IS NOT NULL',
  });
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
