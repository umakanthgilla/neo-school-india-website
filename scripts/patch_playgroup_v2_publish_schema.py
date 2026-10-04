from pathlib import Path

p = Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s = p.read_text()

# Preserve an explicit schema marker for new Playgroup V2 masters while leaving
# published legacy/V1 records (which have no marker) backward compatible.
marker_validation = """ const curriculumSchema=typeof b.curriculum_schema==='string'?b.curriculum_schema.trim():'';
 if(curriculumSchema&&curriculumSchema!=='playgroup-v2')
  fail('Unsupported curriculum schema.');
 if(curriculumSchema==='playgroup-v2'&&b.level.trim()!=='Playgroup')
  fail('Playgroup V2 schema can only be used for Playgroup.');

"""
if "const curriculumSchema=typeof b.curriculum_schema" not in s:
    anchor = """ if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>160)
  fail('Enter a curriculum title.');

"""
    if s.count(anchor) != 1:
        raise SystemExit('Master curriculum title validation marker not found uniquely')
    s = s.replace(anchor, anchor + marker_validation, 1)

if "curriculum_schema:curriculumSchema" not in s:
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

p.write_text(s)
print('Playgroup V2 schema marker and production publish guard applied.')
