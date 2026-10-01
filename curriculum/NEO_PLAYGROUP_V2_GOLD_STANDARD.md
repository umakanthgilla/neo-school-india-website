# Neo School India — Playgroup V2 Gold Standard

Status: curriculum development standard for the next Playgroup version. The currently published Playgroup 2026.2 / V1 remains locked as the production baseline.

## Purpose

Neo Playgroup V2 must be easier to implement than a traditional preschool manual while providing deeper instructional guidance, stronger observation traceability and clearer parent communication. Reference systems, including the supplied Kidzee manuals, worksheets, observation sheets and centre-quality documents, are used for benchmarking of depth and implementation discipline only. Neo content, wording, activities, resources, artwork, codes and assessment language must remain original.

External alignment reference: National Curriculum Framework for Foundational Stage (NCF-FS) 2022, Ministry of Education / NCERT.

## Non-negotiable design principles

1. **Play at the centre.** Every day balances child-led/free play, guided play and structured play. Worksheets are support resources, not the curriculum itself.
2. **Outcome first.** Every planned experience maps to an observable developmental outcome. Outcomes are developmental trajectories, not pass/fail targets.
3. **One teacher screen, no manual hunting.** A teacher should be able to open one Day Card and see preparation, materials, steps, teacher language, questions, support/challenge, safety, observation cue, resource and parent connection.
4. **Full-day coherence.** The 9-block school-day rhythm is retained, but each block has a purpose. The core lesson must connect with language/story, motor/sensory, creative reinforcement and reflection where pedagogically useful.
5. **Simple for the child.** Short instructions, concrete materials, movement, senses, stories, music, imitation, choice and repetition are preferred over abstract explanation.
6. **Simple for the parent.** Parent communication uses plain language: what the child explored, why it matters, one realistic home connection and any optional resource.
7. **Evidence without over-testing.** Observation is embedded in normal play. No marks, ranks or worksheet scores for Playgroup.
8. **Inclusion by design.** Every lesson includes a support path and, where useful, an extension path. Participation can be verbal, gestural, visual, motor or assisted.
9. **Resource separation.** Worksheets, flashcards, story cards, audio, printables and parent cards live in a versioned Resource Library and link to lessons by stable Resource ID.
10. **Version safety.** Published curriculum is immutable. New academic/government changes create V2/V3 instead of overwriting historical delivery.

## V2 lesson record

Every curriculum lesson should support these fields:

### Identity and mapping
- Day 1–200
- Lesson ID
- Level / curriculum version
- Month / week / local day
- Daily block and start/end time
- Neo learning domain
- Skill / sub-skill
- NCF curricular goal / competency / learning-outcome reference where appropriate

### Teacher-ready content
- Concept / learning focus
- Observable objective
- Why this matters
- Materials and quantity/prepare note
- Step-by-step teaching sequence
- Teacher language / modelling cue
- 1–5 approved open prompts
- Child choice / agency opportunity
- Support / scaffold
- Challenge / extension
- Inclusion / accessibility note
- Safety / supervision note
- Transition or clean-up cue where relevant

### Assessment and evidence
- Observe-for statement
- Evidence suggestion
- Neo observation status: Emerging / Developing / Consistent / Not Observed
- Portfolio suggestion
- Follow-up trigger when repeated support is needed

### Resource connection
- Resource required? Yes / Optional / No
- Resource ID
- Resource type: Worksheet / Printable / Flashcard / Story Card / Audio / Visual / Parent Card / Activity Card
- Resource title
- Resource URL/file reference
- Teacher resource instruction
- Parent-share permission

### Parent connection
- Plain-language learning summary
- Home connection
- Optional parent prompt
- No homework burden requirement for Playgroup

## 9-block Playgroup day

Current recurring rhythm remains the base:

1. 09:30–09:45 Arrival & Settling
2. 09:45–10:05 Circle Time
3. 10:05–10:30 IMLS Core Experience
4. 10:30–10:45 Snack & Practical Life
5. 10:45–11:10 Language / Story / Sound Play
6. 11:10–11:35 Motor / Sensory / Outdoor
7. 11:35–12:00 Creative / Concept Reinforcement
8. 12:00–12:15 Reflection & My Neo Moment
9. 12:15–12:30 Pack-up & Goodbye

V1 currently contains detailed dated content primarily for the 10:05–10:30 core block. V2 work expands the pedagogical mapping across the full day without turning every routine into a rigid scripted lesson.

## Resource Library standard

Resource IDs must be Neo-owned and stable, for example:

`PG-V2-D032-WS01`

Recommended pattern:

`<LEVEL>-<VERSION>-D<DAY>-<TYPE><SEQUENCE>`

Examples of TYPE: `WS`, `FC`, `SC`, `AU`, `PR`, `PC`, `AC`.

A resource record stores: Resource ID, level, version, day, lesson ID, type, title, objective, materials, teacher use, parent use, file/URL, share permission, status and revision note.

## Assessment traceability

A mature curriculum should answer this chain for any observation:

**Domain → Skill → Observable Outcome → Planned Experience → Day/Block → Teacher Observation → Evidence → Parent-safe summary → My Neo Journey**

This is intentionally stronger than a standalone term observation sheet because the teacher does not have to manually remember which session proves which learning outcome.

## Teacher implementation standard

A new teacher should be able to conduct the day without opening multiple manuals. The teacher experience should prioritize:

- Today’s 9 blocks in order
- Materials readiness at a glance
- One-tap lesson instructions
- Resource links beside the relevant block
- Observe-for cues beside the activity
- Simple completion/partial/follow-up status
- Child-specific observations only when meaningful
- Parent sharing controlled separately from teacher notes

## Parent implementation standard

Parents should not see curriculum jargon by default. Parent-facing output should say:

- Today we explored…
- This helps build…
- You can try at home…
- Optional resource…

The system must avoid implying mastery from one classroom participation event.

## Academic quality gates for production publish

A V2 Playgroup production version should not publish unless:

- 200 curriculum days are covered.
- All 200 core lessons have objective, activity, materials and at least one approved parent prompt.
- All 200 core lessons have an observe-for/evidence cue.
- All 200 core lessons have teacher language or modelling guidance.
- Every linked resource has a valid stable Resource ID and approved file/reference.
- Full-day block plan has no time overlap.
- Safety-sensitive activities contain a supervision/safety note.
- Resource links do not use third-party copyrighted worksheets unless licensed/authorized.
- Head Office review status is complete.

## Reference strengths incorporated without copying

From the supplied benchmark materials, Neo adopts the *principles* of:

- explicit objectives,
- materials lists,
- sequenced teacher instructions,
- lesson-to-resource linkage,
- domain/skill/observable-goal assessment structure,
- class/session traceability,
- teacher induction and curriculum-execution quality checks,
- parent connection,
- safety and centre-operating discipline.

Neo improves on the paper/manual model through automatic Day 1–200 calendar mapping, version control, teacher classroom assignment, live timetable generation, resource linking, embedded observation, portfolio history and parent-safe digital communication.

## Reference set used for this standard

- User-supplied eKidzee reference: https://www.ekidzee.com/Download/Details
- Supplied Kidzee Teacher Manuals / Supplements bundle
- Supplied Playgroup, Nursery, Jr KG and Sr KG observation sheets
- Supplied worksheet samples including concept, mathematics and ERP resources
- Supplied centre compliance and safety documents
- NCF-FS 2022: https://www.education.gov.in/sites/upload_files/mhrd/files/NCF_for_Foundational_Stage_20_October_2022.pdf

## Next build sequence

1. Convert V1 200 core lessons into the V2 master field structure without changing the published V1.
2. Build a 200-day × 9-block V2 planning grid.
3. Map V1 core lessons into the IMLS Core block; mark the other blocks for V2 enrichment.
4. Build Resource Library and stable Resource IDs.
5. Build Observation Map directly from curriculum objectives/evidence cues.
6. Enrich blocks month-by-month with original Neo content.
7. Add NCF competency references and inclusion/safety review.
8. Only after academic review, publish as a new curriculum version.