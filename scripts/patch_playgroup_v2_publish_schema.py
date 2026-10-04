from pathlib import Path

p = Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s = p.read_text()

# Preserve an explicit schema marker for new Playgroup V2 masters while leaving
# published legacy/V1 records (which have no marker) backward compatible.
# Production Playgroup V2 also requires a stored Head Office academic approval.
marker_validation = """ const curriculumSchema=typeof b.curriculum_schema==='string'?b.curriculum_schema.trim():'';
 if(curriculumSchema&&curriculumSchema!=='playgroup-v2')
  fail('Unsupported curriculum schema.');
 if(curriculumSchema==='playgroup-v2'&&b.level.trim()!=='Playgroup')
  fail('Playgroup V2 schema can only be used for Playgroup.');

"""
if "const academicReviewStatus=typeof b.academic_review_status" not in s:
    anchor = """ if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>160)
  fail('Enter a curriculum title.');

"""
    academic = """ const academicReviewStatus=typeof b.academic_review_status==='string'&&b.academic_review_status.trim()?b.academic_review_status.trim():'Pending';
 if(!['Pending','ReadyForReview','Approved'].includes(academicReviewStatus))
  fail('Invalid academic review status.');
 const academicReviewNotes=typeof b.academic_review_notes==='string'?b.academic_review_notes.trim():'';
 if(academicReviewNotes.length>4000)fail('Academic review notes are too long.');
 const academicReviewedAt=typeof b.academic_reviewed_at==='string'?b.academic_reviewed_at.trim():'';
 if(academicReviewedAt.length>40)fail('Invalid academic review timestamp.');

"""
    if s.count(anchor) != 1:
        raise SystemExit('Academic review validation anchor not found uniquely')
    s = s.replace(anchor, anchor + academic, 1)

if "const curriculumSchema=typeof b.curriculum_schema" not in s:
    anchor = """ if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>160)
  fail('Enter a curriculum title.');

"""
    if s.count(anchor) != 1:
        raise SystemExit('Master curriculum title validation marker not found uniquely')
    s = s.replace(anchor, anchor + marker_validation, 1)

if "curriculum_schema:curriculumSchema" not in s:
if "academic_review_status:academicReviewStatus" not in s:
    anchor = """  curriculum_schema:curriculumSchema,
  lessons,"""
    replacement = """  curriculum_schema:curriculumSchema,
  academic_review_status:academicReviewStatus,
  academic_review_notes:academicReviewNotes,
  academic_reviewed_at:academicReviewedAt,
  lessons,"""
    if s.count(anchor) != 1:
        raise SystemExit('Academic review return anchor not found uniquely')
    s = s.replace(anchor, replacement, 1)

    anchor = """  title:b.title.trim(),
  lessons,"""
    replacement = """  title:b.title.trim(),
  curriculum_schema:curriculumSchema,
  lessons,"""
    if s.count(anchor) != 1:
        raise SystemExit('Master curriculum return marker not found uniquely')
    s = s.replace(anchor, replacement, 1)

old_gate = "if(!testMode&&checked.level==='Playgroup'&&Array.isArray(checked.daily_experiences)&&checked.daily_experiences.length){"
new_gate = "if(!testMode&&checked.level==='Playgroup'&&(checked.curriculum_schema==='playgroup-v2'||checked.daily_experiences.length>0)){"
if old_gate in s:
    s = s.replace(old_gate, new_gate, 1)
elif new_gate not in s:
    raise SystemExit('Playgroup V2 publish gate marker not found')

academic_gate = """if(!testMode&&checked.level==='Playgroup'&&checked.curriculum_schema==='playgroup-v2'&&checked.academic_review_status!=='Approved')
  return out({error:'Playgroup V2 production publish is locked until Head Office academic review is approved.'},400);

"""
if "academic review is approved" not in s:
    publish_anchor = "if(!testMode&&checked.level==='Playgroup'&&(checked.curriculum_schema==='playgroup-v2'||checked.daily_experiences.length>0)){"
    if s.count(publish_anchor) != 1:
        raise SystemExit('Playgroup V2 academic gate anchor not found uniquely')
    s = s.replace(publish_anchor, academic_gate + publish_anchor, 1)

p.write_text(s)
print('Playgroup V2 schema marker, academic approval and production publish guards applied.')
