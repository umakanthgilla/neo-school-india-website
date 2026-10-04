from pathlib import Path

p = Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s = p.read_text()

# Foundational V2 schema marker + Head Office academic approval gate.
# Existing Playgroup V2 production history stays backward compatible.
title_anchor = """ if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>160)
  fail('Enter a curriculum title.');

"""

academic_validation = """ const academicReviewStatus=typeof b.academic_review_status==='string'&&b.academic_review_status.trim()?b.academic_review_status.trim():'Pending';
 if(!['Pending','ReadyForReview','Approved'].includes(academicReviewStatus))
  fail('Invalid academic review status.');
 const academicReviewNotes=typeof b.academic_review_notes==='string'?b.academic_review_notes.trim():'';
 if(academicReviewNotes.length>4000)fail('Academic review notes are too long.');
 const academicReviewedAt=typeof b.academic_reviewed_at==='string'?b.academic_reviewed_at.trim():'';
 if(academicReviewedAt.length>40)fail('Invalid academic review timestamp.');

"""

schema_validation = """ const curriculumSchema=typeof b.curriculum_schema==='string'?b.curriculum_schema.trim():'';
 const v2LevelBySchema={'playgroup-v2':'Playgroup','nursery-v2':'Nursery'};
 if(curriculumSchema&&!v2LevelBySchema[curriculumSchema])
  fail('Unsupported curriculum schema.');
 if(curriculumSchema&&b.level.trim()!==v2LevelBySchema[curriculumSchema])
  fail(v2LevelBySchema[curriculumSchema]+' V2 schema can only be used for '+v2LevelBySchema[curriculumSchema]+'.');

"""

if "const academicReviewStatus=typeof b.academic_review_status" not in s:
    if s.count(title_anchor) != 1:
        raise SystemExit('Academic review validation anchor not found uniquely')
    s = s.replace(title_anchor, title_anchor + academic_validation, 1)

if "const v2LevelBySchema={'playgroup-v2':'Playgroup','nursery-v2':'Nursery'}" not in s:
    old_schema_start = " const curriculumSchema=typeof b.curriculum_schema==='string'?b.curriculum_schema.trim():'';"
    start = s.find(old_schema_start)
    lesson_anchor = "\n if(!Array.isArray(b.lessons)||b.lessons.length<1||b.lessons.length>2200)"
    end = s.find(lesson_anchor, start)
    if start < 0 or end < 0:
        raise SystemExit('Master curriculum schema validation marker not found')
    s = s[:start] + schema_validation.rstrip() + s[end:]

if "curriculum_schema:curriculumSchema" not in s:
    anchor = """  title:b.title.trim(),
  lessons,"""
    replacement = """  title:b.title.trim(),
  curriculum_schema:curriculumSchema,
  lessons,"""
    if s.count(anchor) != 1:
        raise SystemExit('Master curriculum return marker not found uniquely')
    s = s.replace(anchor, replacement, 1)

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

# Current production source must protect both V2 levels.
required = [
    "['playgroup-v2','nursery-v2'].includes(checked.curriculum_schema)",
    "'nursery-v2':[",
    "checked.daily_experiences.length!==1800",
    "academic review is approved."
]
missing = [item for item in required if item not in s]
if missing:
    raise SystemExit('Foundational V2 publish guards missing: ' + ', '.join(missing))

p.write_text(s)
print('Foundational V2 schema markers and production publish guards verified.')
