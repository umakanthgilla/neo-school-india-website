// @ts-nocheck
const ALLOWED_ORIGINS = new Set([
  "https://neo-school-india-website.pages.dev",
  "https://neoschoolindia.com",
  "https://www.neoschoolindia.com",
]);

const ALLOWED_TYPES = new Set([
  "Preschool Admission",
  "Franchise Enquiry",
  "Teacher Training",
  "Phonics Training",
  "Academic Partnership",
  "School Services",
]);

const ALLOWED_STATUS = new Set([
  "New",
  "Contacted",
  "Follow-up",
  "Interested",
  "Visit / Meeting",
  "Decision Pending",
  "Converted",
  "Lost",
]);

const ALLOWED_PRIORITY = new Set([
  "Hot",
  "Warm",
  "Cold",
]);

function cors(request) {
  const origin = request.headers.get("Origin") || "";

  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://neo-school-india-website.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      ...cors(request),
    },
  });
}

function clean(value, max = 500) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

function leadId() {
  const now = new Date();

  const date =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");

  const random = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `NEO-${date}-${random}`;
}

/* ==============================
   ADMIN SESSION TOKEN
================================ */

function base64urlEncode(value) {
  const bytes =
    value instanceof Uint8Array
      ? value
      : new TextEncoder().encode(value);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(value) {
  value = value.replace(/-/g, "+").replace(/_/g, "/");

  while (value.length % 4) {
    value += "=";
  }

  const binary = atob(value);

  return Uint8Array.from(
    binary,
    char => char.charCodeAt(0)
  );
}

async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

async function createAdminToken(secret) {
  const payload = {
    role: "admin",
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };

  const encodedPayload = base64urlEncode(
    JSON.stringify(payload)
  );

  const key = await getSigningKey(secret);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );

  return `${encodedPayload}.${base64urlEncode(
    new Uint8Array(signature)
  )}`;
}

async function verifyAdminToken(token, secret) {
  try {
    if (!token || !secret) return false;

    const [payloadPart, signaturePart] =
      token.split(".");

    if (!payloadPart || !signaturePart) {
      return false;
    }

    const key = await getSigningKey(secret);

    const validSignature =
      await crypto.subtle.verify(
        "HMAC",
        key,
        base64urlDecode(signaturePart),
        new TextEncoder().encode(payloadPart)
      );

    if (!validSignature) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(
        base64urlDecode(payloadPart)
      )
    );

    return (
      payload.role === "admin" &&
      Number(payload.exp) > Date.now()
    );
  } catch {
    return false;
  }
}

async function requireAdmin(request, env) {
  const auth =
    request.headers.get("Authorization") || "";

  if (!auth.startsWith("Bearer ")) {
    return false;
  }

  const token = auth.slice(7).trim();

  return verifyAdminToken(
    token,
    env.ADMIN_PASSWORD
  );
}

/* ==============================
   MAIN WORKER
================================ */

export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors(request),
      });
    }

    const url = new URL(request.url);
    const transportOperationsResponse = await transportOperations(request, env, url);
    if (transportOperationsResponse) return transportOperationsResponse;
    const transportResponse = await transportPortal(request, env, url);
    if (transportResponse) return transportResponse;
    const supplyResponse = await supplyChain(request, env, url);
    if (supplyResponse) return supplyResponse;
    const learningResponse = await learningPortal(request, env, url);
    if (learningResponse) return learningResponse;
    const employeeResponse = await employeePortal(request, env, url);
    if (employeeResponse) return employeeResponse;
    const teacherResponse = await teacherPortal(request, env, url);
    if (teacherResponse) return teacherResponse;
    const parentResponse = await parentPortal(request, env, url);
    if (parentResponse) return parentResponse;
    const portalResponse = await schoolPortal(request, env, url);
    if (portalResponse) return portalResponse;
    const intakeResponse = await admissionIntake(request, env, url);
    if (intakeResponse) return intakeResponse;
    const franchiseResponse = await franchiseRoute(request, env, url);
    if (franchiseResponse) return franchiseResponse;

    /* --------------------------
       HEALTH CHECK
    --------------------------- */

    if (
      request.method === "GET" &&
      url.pathname === "/"
    ) {
      return json(
        {
          status: "ok",
          service: "Neo Lead CRM API",
          database: "connected",
          admin: "enabled",
        },
        200,
        request
      );
    }

    /* ==========================
       PUBLIC WEBSITE LEADS
    =========================== */

    if (
      request.method === "POST" &&
      url.pathname === "/api/leads"
    ) {
      try {

        const contentType =
          request.headers.get("content-type") || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          return json(
            {
              success: false,
              error: "JSON request required.",
            },
            415,
            request
          );
        }

        const body = await request.json();

        const name =
          clean(body.name, 120);

        const mobile =
          clean(body.mobile || body.phone, 20);

        const email =
          clean(body.email, 160).toLowerCase();

        const city =
          clean(body.city, 120);

        const state =
          clean(body.state, 120);

        const enquiryType =
          clean(
            body.enquiry_type ||
              body.enquiryType,
            80
          );

        const childName =
          clean(
            body.child_name ||
              body.childName,
            120
          );

        const childAge =
          clean(
            body.child_age ||
              body.childAge,
            30
          );

        const program =
          clean(body.program, 80);

        const proposedLocation =
          clean(
            body.proposed_location ||
              body.proposedLocation,
            160
          );

        const notes =
          clean(
            body.notes ||
              body.message,
            1500
          );

        const source =
          clean(
            body.source || "Website",
            80
          );

        if (!name) {
          return json(
            {
              success: false,
              error: "Name is required.",
            },
            400,
            request
          );
        }

        const digits =
          mobile.replace(/\D/g, "");

        if (
          digits.length < 10 ||
          digits.length > 15
        ) {
          return json(
            {
              success: false,
              error:
                "Please enter a valid mobile number.",
            },
            400,
            request
          );
        }

        if (
          !ALLOWED_TYPES.has(enquiryType)
        ) {
          return json(
            {
              success: false,
              error:
                "Please select a valid enquiry type.",
            },
            400,
            request
          );
        }

        if (
          email &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
          )
        ) {
          return json(
            {
              success: false,
              error:
                "Please enter a valid email address.",
            },
            400,
            request
          );
        }

        const id = leadId();

        await env.DB.prepare(`
          INSERT INTO leads (
            lead_id,
            enquiry_type,
            name,
            mobile,
            email,
            city,
            state,
            child_name,
            child_age,
            program,
            proposed_location,
            source,
            status,
            priority,
            notes
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            'New',
            'Warm',
            ?
          )
        `)
          .bind(
            id,
            enquiryType,
            name,
            mobile,
            email || null,
            city || null,
            state || null,
            childName || null,
            childAge || null,
            program || null,
            proposedLocation || null,
            source,
            notes || null
          )
          .run();

        return json(
          {
            success: true,
            message:
              "Thank you. Your enquiry has been received.",
            lead_id: id,
            status: "New",
          },
          201,
          request
        );

      } catch (error) {

        console.error(
          "Lead submission error:",
          error
        );

        return json(
          {
            success: false,
            error:
              "Unable to save enquiry. Please try again.",
          },
          500,
          request
        );
      }
    }

    /* ==========================
       ADMIN LOGIN
    =========================== */

    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/login"
    ) {
      try {

        const body = await request.json();

        const password =
          clean(body.password, 300);

        if (
          !env.ADMIN_PASSWORD ||
          password !== env.ADMIN_PASSWORD
        ) {
          return json(
            {
              success: false,
              error:
                "Incorrect admin password.",
            },
            401,
            request
          );
        }

        const token =
          await createAdminToken(
            env.ADMIN_PASSWORD
          );

        return json(
          {
            success: true,
            token,
            expires_in: 43200,
          },
          200,
          request
        );

      } catch {
        return json(
          {
            success: false,
            error: "Unable to login.",
          },
          400,
          request
        );
      }
    }

    /* ==========================
       ADMIN DASHBOARD METRICS
    =========================== */

    if (
      request.method === "GET" &&
      url.pathname ===
        "/api/admin/dashboard"
    ) {

      if (
        !(await requireAdmin(
          request,
          env
        ))
      ) {
        return json(
          {
            success: false,
            error: "Unauthorized.",
          },
          401,
          request
        );
      }

      const metrics =
        await env.DB.prepare(`
          SELECT

            COUNT(*) AS total,

            SUM(
              CASE WHEN status = 'New'
              THEN 1 ELSE 0 END
            ) AS new_leads,

            SUM(
              CASE
              WHEN enquiry_type =
                'Preschool Admission'
              THEN 1 ELSE 0 END
            ) AS admissions,

            SUM(
              CASE
              WHEN enquiry_type =
                'Franchise Enquiry'
              THEN 1 ELSE 0 END
            ) AS franchises,

            SUM(
              CASE
              WHEN status = 'Converted'
              THEN 1 ELSE 0 END
            ) AS converted,

            SUM(
              CASE
              WHEN status = 'Lost'
              THEN 1 ELSE 0 END
            ) AS lost,

            SUM(
              CASE
              WHEN date(next_follow_up)
                = date('now')
              AND status NOT IN
                ('Converted','Lost')
              THEN 1 ELSE 0 END
            ) AS today_followups,

            SUM(
              CASE
              WHEN date(next_follow_up)
                < date('now')
              AND next_follow_up IS NOT NULL
              AND next_follow_up != ''
              AND status NOT IN
                ('Converted','Lost')
              THEN 1 ELSE 0 END
            ) AS overdue

          FROM leads
        `).first();

      return json(
        {
          success: true,
          metrics,
        },
        200,
        request
      );
    }

    /* ==========================
       ADMIN LIST LEADS
    =========================== */

    if (
      request.method === "GET" &&
      url.pathname ===
        "/api/admin/leads"
    ) {

      if (
        !(await requireAdmin(
          request,
          env
        ))
      ) {
        return json(
          {
            success: false,
            error: "Unauthorized.",
          },
          401,
          request
        );
      }

      const type =
        clean(
          url.searchParams.get("type"),
          80
        );

      const status =
        clean(
          url.searchParams.get("status"),
          80
        );

      const search =
        clean(
          url.searchParams.get("search"),
          100
        );

      let sql = `
        SELECT *
        FROM leads
        WHERE 1 = 1
      `;

      const binds = [];

      if (type) {
        sql +=
          " AND enquiry_type = ?";
        binds.push(type);
      }

      if (status) {
        sql += " AND status = ?";
        binds.push(status);
      }

      if (search) {
        sql += `
          AND (
            name LIKE ?
            OR mobile LIKE ?
            OR city LIKE ?
            OR lead_id LIKE ?
          )
        `;

        const q = `%${search}%`;

        binds.push(q, q, q, q);
      }

      sql += `
        ORDER BY id DESC
        LIMIT 500
      `;

      let statement =
        env.DB.prepare(sql);

      if (binds.length) {
        statement =
          statement.bind(...binds);
      }

      const result =
        await statement.all();

      return json(
        {
          success: true,
          leads: result.results || [],
        },
        200,
        request
      );
    }

    /* ==========================
       ADMIN UPDATE LEAD
    =========================== */

    const updateMatch =
      url.pathname.match(
        /^\/api\/admin\/leads\/([^/]+)$/
      );

    if (
      request.method === "PATCH" &&
      updateMatch
    ) {

      if (
        !(await requireAdmin(
          request,
          env
        ))
      ) {
        return json(
          {
            success: false,
            error: "Unauthorized.",
          },
          401,
          request
        );
      }

      const id =
        decodeURIComponent(
          updateMatch[1]
        );

      const body =
        await request.json();

      const status =
        clean(body.status, 80);

      const priority =
        clean(body.priority, 30);

      // Omitted PATCH fields retain their value; explicit blanks clear it.
      const patchText = (key, alias, limit, previous) => {
        const present = Object.prototype.hasOwnProperty.call(body, key);
        const aliasPresent = alias && Object.prototype.hasOwnProperty.call(body, alias);
        if (!present && !aliasPresent) return previous ?? null;
        return clean(present ? body[key] : body[alias], limit) || null;
      };

      if (
        status &&
        !ALLOWED_STATUS.has(status)
      ) {
        return json(
          {
            success: false,
            error: "Invalid status.",
          },
          400,
          request
        );
      }

      if (
        priority &&
        !ALLOWED_PRIORITY.has(priority)
      ) {
        return json(
          {
            success: false,
            error: "Invalid priority.",
          },
          400,
          request
        );
      }

      const existing =
        await env.DB.prepare(`
          SELECT *
          FROM leads
          WHERE lead_id = ?
          LIMIT 1
        `)
          .bind(id)
          .first();

      if (!existing) {
        return json(
          {
            success: false,
            error: "Lead not found.",
          },
          404,
          request
        );
      }

      const finalStatus =
        status || existing.status;

      const convertedDate =
        finalStatus === "Converted"
          ? existing.converted_date ||
            new Date().toISOString()
          : null;

      await env.DB.prepare(`
        UPDATE leads
        SET
          status = ?,
          priority = ?,
          assigned_to = ?,
          next_follow_up = ?,
          follow_up_result = ?,
          notes = ?,
          converted_date = ?,
          lost_reason = ?,
          last_contact = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE lead_id = ?
      `)
        .bind(
          finalStatus,
          priority ||
            existing.priority ||
            "Warm",
          patchText("assigned_to", "assignedTo", 120, existing.assigned_to),
          patchText("next_follow_up", "nextFollowUp", 50, existing.next_follow_up),
          patchText("follow_up_result", "followUpResult", 200, existing.follow_up_result),
          patchText("notes", null, 2000, existing.notes),
          convertedDate,
          patchText("lost_reason", "lostReason", 500, existing.lost_reason),
          body.record_contact === true ? new Date().toISOString() : existing.last_contact ?? null,
          id
        )
        .run();

      const updated =
        await env.DB.prepare(`
          SELECT *
          FROM leads
          WHERE lead_id = ?
        `)
          .bind(id)
          .first();

      return json(
        {
          success: true,
          lead: updated,
        },
        200,
        request
      );
    }

    return json(
      {
        success: false,
        error: "Not found.",
      },
      404,
      request
    );
  },
};
// Additive tables: existing leads and the existing admin password are retained.
const SCHOOL_TASKS = ['Location review','Agreement signed','Classroom setup','Safety readiness','Teacher training','Launch approval'];
const SCHOOL_SCHEMA = [
 `CREATE TABLE IF NOT EXISTS neo_schools (school_id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, owner TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS neo_school_tasks (school_id TEXT NOT NULL, task TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY(school_id,task))`,
 `CREATE TABLE IF NOT EXISTS neo_login_attempts (school_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL)`
];
function strongPortalPassword(p){return typeof p==='string'&&p.length>=8&&p.length<=128&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9\s]/.test(p)&&!/[\r\n]/.test(p)}
async function schoolPassword(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return base64urlEncode(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)));
}
async function schoolToken(school,secret){
 const p=base64urlEncode(JSON.stringify({role:'school',school_id:school.school_id,version:school.password_hash,exp:Date.now()+8*3600000}));
 return p+'.'+base64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC',await getSigningKey(secret),new TextEncoder().encode(p))));
}
async function schoolSession(request,env){
 try{
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 const parts=token.split('.');if(parts.length!==2||!env.ADMIN_PASSWORD)return null;
 if(!await crypto.subtle.verify('HMAC',await getSigningKey(env.ADMIN_PASSWORD),base64urlDecode(parts[1]),new TextEncoder().encode(parts[0])))return null;
 const p=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
 if(p.role!=='school'||p.exp<=Date.now())return null;
 const s=await env.DB.prepare('SELECT * FROM neo_schools WHERE school_id=? AND active=1').bind(p.school_id).first();
 return s&&s.password_hash===p.version?s:null;
 }catch{return null;}
}
function publicSchool(s){const {password_hash,salt,...rest}=s;return rest;}
async function franchiseRoute(request,env,url){
 if(!url.pathname.startsWith('/api/franchise/'))return null;
 const reply=(data,status=200)=>json(data,status,request);
 const error=(message,status)=>reply({success:false,error:message},status);
 try{
 const admin=await requireAdmin(request,env);
 if(url.pathname==='/api/franchise/setup'&&request.method==='POST'){
  if(!admin)return error('Unauthorized.',401);
  await env.DB.batch(SCHOOL_SCHEMA.map(sql=>env.DB.prepare(sql)));
  return reply({success:true});
 }
 if(url.pathname==='/api/franchise/login'&&request.method==='POST'){
  if(!env.ADMIN_PASSWORD)return error('Login unavailable.',503);
  const body=await request.json();const id=clean(body.school_id,64).toUpperCase();
  if(!id||typeof body.password!=='string'||body.password.length>128)return error('Invalid login.',400);
  const now=Date.now();
  const counter=await env.DB.prepare(`INSERT INTO neo_login_attempts(school_id,attempts,expires) VALUES (?,1,?) ON CONFLICT(school_id) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts`).bind(id,now+900000,now,now,now+900000).first();
  if(counter.attempts>10)return error('Too many attempts. Try again after 15 minutes.',429);
  const s=await env.DB.prepare('SELECT * FROM neo_schools WHERE school_id=? AND active=1').bind(id).first();
  const hash=await schoolPassword(body.password,s?.salt||'neo-invalid-account');
  if(!s||hash!==s.password_hash)return error('Incorrect school ID or password.',401);
  return reply({success:true,token:await schoolToken(s,env.ADMIN_PASSWORD)});
 }
 if(!admin && !await schoolSession(request,env))return error('Unauthorized.',401);
 if(url.pathname==='/api/franchise/schools'&&request.method==='GET'){
  if(!admin)return error('Head-office access required.',403);
  const r=await env.DB.prepare('SELECT school_id,name,city,owner,active,created_at FROM neo_schools ORDER BY created_at DESC').all();
  return reply({success:true,schools:r.results||[]});
 }
 if(url.pathname==='/api/franchise/schools'&&request.method==='POST'){
  if(!admin)return error('Head-office access required.',403);
  const b=await request.json();const name=clean(b.name,160),city=clean(b.city,120),owner=clean(b.owner,120);
  if(!name||!city||!owner||!strongPortalPassword(b.password))return error('School, city, owner and a 8â€“128 character password with uppercase, lowercase, number and symbol are required.',400);
  const id='NEO-'+crypto.randomUUID().slice(0,8).toUpperCase(),salt=crypto.randomUUID();
  const hash=await schoolPassword(b.password,salt);
  await env.DB.batch([env.DB.prepare('INSERT INTO neo_schools(school_id,name,city,owner,password_hash,salt) VALUES (?,?,?,?,?,?)').bind(id,name,city,owner,hash,salt),...SCHOOL_TASKS.map(t=>env.DB.prepare('INSERT INTO neo_school_tasks(school_id,task) VALUES (?,?)').bind(id,t))]);
  return reply({success:true,school_id:id},201);
 }
 const match=url.pathname.match(/^\/api\/franchise\/schools\/([^/]+)$/);
 if(match){
  const id=decodeURIComponent(match[1]);
  if(!admin){const s=await schoolSession(request,env);if(s.school_id!==id)return error('Access denied.',403);}
  const school=await env.DB.prepare('SELECT * FROM neo_schools WHERE school_id=?').bind(id).first();
  if(!school)return error('School not found.',404);
  if(request.method==='GET'){
   const tasks=await env.DB.prepare('SELECT task,completed,updated_at FROM neo_school_tasks WHERE school_id=?').bind(id).all();
   return reply({success:true,school:publicSchool(school),tasks:tasks.results||[]});
  }
  if(request.method==='PATCH'){
   if(!admin)return error('Only head office can approve readiness or change access.',403);
   const b=await request.json();
   if(SCHOOL_TASKS.includes(b.task)&&typeof b.completed==='boolean'){
    await env.DB.prepare('UPDATE neo_school_tasks SET completed=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND task=?').bind(b.completed?1:0,id,b.task).run();
   }else if(typeof b.active==='boolean'){
    await env.DB.prepare('UPDATE neo_schools SET active=? WHERE school_id=?').bind(b.active?1:0,id).run();
   }else if(strongPortalPassword(b.password)){
    const salt=crypto.randomUUID();await env.DB.prepare('UPDATE neo_schools SET password_hash=?,salt=? WHERE school_id=?').bind(await schoolPassword(b.password,salt),salt,id).run();
   }else return error('Invalid update.',400);
   return reply({success:true});
  }
 }
 if(url.pathname==='/api/franchise/me'&&request.method==='GET'){
  const school=await schoolSession(request,env);if(!school)return error('School login required.',401);
  const tasks=await env.DB.prepare('SELECT task,completed,updated_at FROM neo_school_tasks WHERE school_id=?').bind(school.school_id).all();
  return reply({success:true,school:publicSchool(school),tasks:tasks.results||[]});
 }
 return error('Not found.',404);
 }catch(e){console.error('Franchise service error',e);return error('Franchise service unavailable. Head office must complete database setup before first use.',503);}
}

// Admission intake: server-owned age policy and prior-school validation.
function admissionAge(dob, year) {
 const d=new Date(dob+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==dob||d>new Date())throw new Error('Enter a valid date of birth.');
 const months=day=>(year-d.getUTCFullYear())*12+6-d.getUTCMonth()-(day<d.getUTCDate()?1:0);
 const band=m=>m<32?'Below minimum':m<44?'Nursery':m<56?'LKG':m<72?'UKG':'Age review';
 const lo=months(1),hi=months(31),a=band(lo),b=band(hi);
 return {program:a===b && ['Nursery','LKG','UKG'].includes(a)?a:'Head-office review',age:`${Math.floor(lo/12)}y ${lo%12}m on July 1`,review:a!==b||!['Nursery','LKG','UKG'].includes(a),note:'July start day is unconfirmed. July birthday boundaries and older children require head-office review; this is not final admission approval.'};
}
async function admissionIntake(request,env,url){
 if(url.pathname!=='/api/admission-intake')return null;
 if(request.method!=='POST')return json({error:'Method not allowed'},405,request);
 let b;try{b=await request.json()}catch{return json({error:'Invalid JSON'},400,request)}
 if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Invalid enquiry'},400,request);
 try {
 const text=(key,max=120)=>{if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max)throw new Error('Please complete '+key);return b[key].trim()};
 const name=text('name'),child=text('child_name'),city=text('city'),mobile=text('mobile',20),dob=text('dob',10);
 if(!/^\+?[\d\s()-]+$/.test(mobile)||mobile.replace(/\D/g,'').length<10||mobile.replace(/\D/g,'').length>15)throw new Error('Enter a valid mobile number.');
 const year=Number(b.academic_year),now=new Date().getUTCFullYear();
 if(!Number.isInteger(year)||year<now||year>now+3)throw new Error('Choose the admission academic year.');
 const age=admissionAge(dob,year);
 if(b.consent!==true)throw new Error('Parent consent is required before submission.');
 const options=['Completed','Currently studying','Not attended'];
 const history=[];
 const levels=age.program==='Nursery'?[]:age.program==='LKG'?['Nursery']:['Nursery','LKG'];
 let review=age.review;
 for(const level of levels){const status=b.previous?.[level];if(!options.includes(status))throw new Error('Provide previous '+level+' status.');history.push(level+': '+status);if(status!=='Completed')review=true;}
 let school='Not applicable (fresh admission)',schoolCity='Not applicable';
 if(levels.some(l=>b.previous[l]!=='Not attended')){school=text('previous_school',160);schoolCity=text('previous_city');}
 const notes=['ADMISSION INTAKE v1',`DOB: ${dob}`,`Academic year: ${year}-${year+1}`,`Suggested class: ${age.program}`,`Age reference: ${age.age}`,age.note,...history,`Previous school: ${school}`,`Previous school city: ${schoolCity}`,`Review: ${review?'Head-office review required':'Standard admission review'}`,`Consent: Parent agreed to Neo contact; ${new Date().toISOString()}`].join('\n');
 const id=leadId();
 await env.DB.prepare(`INSERT INTO leads (lead_id,enquiry_type,name,mobile,city,child_name,child_age,program,source,status,priority,notes) VALUES (?,'Preschool Admission',?,?,?,?,?,?,'Ask Neo admission intake','New','Warm',?)`).bind(id,name,mobile,city,child,age.age,age.program,notes).run();
 return json({success:true,lead_id:id,program:age.program,review_required:review},201,request);
 }catch(e){if(e.message.startsWith('Please')||e.message.startsWith('Enter')||e.message.startsWith('Choose')||e.message.startsWith('Provide')||e.message.startsWith('Parent'))return json({error:e.message},400,request);return json({error:'Could not confirm submission. Please contact Neo before trying again to avoid a duplicate enquiry.'},503,request);}
}


// School portal v1: school-owned records; no cross-school reads or writes.
const PORTAL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS neo_master_curricula (id TEXT PRIMARY KEY, level TEXT NOT NULL, version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Draft', data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT, UNIQUE(level,version))`,
 `CREATE TABLE IF NOT EXISTS neo_learning_plans (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, classroom_id TEXT NOT NULL, academic_year TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Draft', data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS neo_learning_active_class ON neo_learning_plans(school_id,classroom_id) WHERE status='Approved'`,
 `CREATE TABLE IF NOT EXISTS neo_learning_completed (plan_id TEXT NOT NULL, lesson_id TEXT NOT NULL, school_id TEXT NOT NULL, classroom_id TEXT NOT NULL, teacher_id TEXT NOT NULL, data TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(plan_id,lesson_id))`,
 `CREATE TABLE IF NOT EXISTS neo_learning_notes (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, student_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS neo_employee_accounts (account_id TEXT PRIMARY KEY, school_id TEXT NOT NULL, staff_id TEXT NOT NULL, name TEXT NOT NULL, staff_type TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(school_id,staff_id))`,
 `CREATE TABLE IF NOT EXISTS neo_teacher_accounts (account_id TEXT PRIMARY KEY, school_id TEXT NOT NULL, name TEXT NOT NULL, classroom_ids TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
 `CREATE TABLE IF NOT EXISTS neo_teacher_staff_links (account_id TEXT PRIMARY KEY, school_id TEXT NOT NULL, staff_id TEXT NOT NULL, UNIQUE(school_id,staff_id))`,
 `CREATE TABLE IF NOT EXISTS neo_parent_accounts (account_id TEXT PRIMARY KEY, school_id TEXT NOT NULL, student_id TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(school_id,student_id))`,
 `CREATE TABLE IF NOT EXISTS neo_portal_records (school_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(school_id,kind,id))`,
 `CREATE TABLE IF NOT EXISTS neo_portal_audit (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS neo_finance_sequences (school_id TEXT NOT NULL, doc_type TEXT NOT NULL, year TEXT NOT NULL, last_no INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(school_id,doc_type,year))`,
 `CREATE TRIGGER IF NOT EXISTS neo_stock_nonnegative BEFORE INSERT ON neo_portal_records WHEN NEW.kind='stock_moves' BEGIN
 SELECT CASE WHEN COALESCE((SELECT SUM(json_extract(data,'$.delta')) FROM neo_portal_records WHERE school_id=NEW.school_id AND kind='stock_moves' AND json_extract(data,'$.item_id')=json_extract(NEW.data,'$.item_id')),0)+json_extract(NEW.data,'$.delta')<0 THEN RAISE(ABORT,'NEO_INSUFFICIENT_STOCK') END; END`,
 `CREATE TRIGGER IF NOT EXISTS neo_portal_payment_balance BEFORE INSERT ON neo_portal_records WHEN NEW.kind='payments' BEGIN
 SELECT CASE WHEN json_extract(NEW.data,'$.amount_paise') >
 COALESCE((SELECT json_extract(data,'$.amount_paise') FROM neo_portal_records WHERE school_id=NEW.school_id AND kind='invoices' AND id=json_extract(NEW.data,'$.invoice_id')),0)
 - COALESCE((SELECT SUM(json_extract(data,'$.amount_paise')) FROM neo_portal_records WHERE school_id=NEW.school_id AND kind='payments' AND json_extract(data,'$.invoice_id')=json_extract(NEW.data,'$.invoice_id')),0)
 THEN RAISE(ABORT,'PORTAL_PAYMENT_EXCEEDS_BALANCE') END; END`

];
async function schoolPortal(request,env,url){
 if(!url.pathname.startsWith('/api/portal/'))return null;
 const out=(b,status=200)=>json(b,status,request);
 try{
  const admin=await requireAdmin(request,env);
  const session=admin?null:await schoolSession(request,env);
  if(!admin&&!session)return out({error:'Sign in required.'},401);
  if(url.pathname==='/api/portal/setup'&&request.method==='POST'){
   if(!admin)return out({error:'Head office only.'},403);
   await env.DB.batch(PORTAL_SCHEMA.map(x=>env.DB.prepare(x)));return out({success:true});
  }
  await ensurePortalSchema(env);
  const extra=await portalExtra(request,env,url,admin,session);if(extra)return extra;
const match=url.pathname.match(/^\/api\/portal\/([^/]+)\/(students|classrooms|fee_structures|homework|announcements|enquiries|attendance|invoices|payments|orders|ledger|support|stock_items|stock_moves|vendors|purchase_orders|goods_receipts|assets|vendor_payables|vendor_payments|teacher_tasks|staff|staff_attendance|payroll|staff_leave|salary_advances|salary_setup|hr_rules|daily_accounts|notifications|vouchers|supply_catalog)(?:\/([^/]+))?$/);
  if(!match)return out({error:'Not found.'},404);
  const [,school,kind,id]=match;
  if(!admin&&session.school_id!==school)return out({error:'Access denied.'},403);
  if(!await env.DB.prepare('SELECT school_id FROM neo_schools WHERE school_id=?').bind(school).first())return out({error:'School not found.'},404);
  if(request.method==='GET'){
   if(kind==='supply_catalog'){await ensureSupplySchema(env);const products=(await supplyRows(env,'products')).filter(x=>x.status==='Active'&&x.available_to_centers!==false&&Number(x.center_price_paise)>0);return out({records:products})}
   if(kind==='daily_accounts')await reconcileHeadOfficePayments(env,school);
   if(kind==='stock_items'||kind==='stock_moves')await reconcileCenterSupplyReceipts(env,school);
   const rows=await env.DB.prepare('SELECT id,data,created_at FROM neo_portal_records WHERE school_id=? AND kind=? ORDER BY created_at DESC,id').bind(school,kind).all();
   let records=rows.results.map(r=>({...JSON.parse(r.data),id:r.id,created_at:r.created_at}));
   if(kind==='notifications'&&!admin)records=records.filter(n=>['hr','finance','school'].includes(n.target));
   return out({records});
  }
  if(!['POST','PATCH'].includes(request.method))return out({error:'Method not allowed.'},405);
  const text=await request.text();if(text.length>16000)return out({error:'Request too large.'},413);
  let b;try{b=JSON.parse(text)}catch{return out({error:'Invalid JSON.'},400)}
  if(!b||typeof b!=='object'||Array.isArray(b))return out({error:'Invalid record.'},400);
  const fail=m=>{throw new TypeError(m)};
  const str=(k,max=200,required=true)=>{const v=typeof b[k]==='string'?b[k].trim():'';if((required&&!v)||v.length>max)fail('Check '+k.replaceAll('_',' ')+'.');return v};
  const choice=(k,values)=>{const v=str(k);if(!values.includes(v))fail('Invalid '+k);return v};
  const date=k=>{const v=str(k);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('Invalid '+k);return v};
  const money=()=>{if(!Number.isSafeInteger(b.amount_paise)||b.amount_paise<=0||b.amount_paise>100000000)fail('Amount must be positive, up to INR 1,000,000.');return b.amount_paise};
  const mobile=()=>{const v=str('mobile',20);if(!/^\+?[0-9 ()-]{8,20}$/.test(v))fail('Check mobile number.');return v};
  const related=async(k,key)=>{const v=str(key,80);const r=await env.DB.prepare('SELECT data FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?').bind(school,k,v).first();if(!r)fail('Related record not found in this school.');return {id:v,...JSON.parse(r.data)}};
  let data,recordId=id||(kind==='staff'&&!b.request_id?('NEO'+String(new Date().getFullYear()).slice(-2)+crypto.randomUUID().replace(/-/g,'').slice(0,4).toUpperCase()):str('request_id',80));
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(recordId))fail('Invalid record ID.');
  if(request.method==='PATCH'){
   const schoolPatch=['students','classrooms','homework','announcements','enquiries','staff_leave','salary_advances','notifications','orders'];
   const headOfficePatch=['orders','purchase_orders','ledger','support','staff_leave','salary_advances','payroll'];
   if(!id||(!admin&&!schoolPatch.includes(kind))||![...schoolPatch,...headOfficePatch].includes(kind))return out({error:'This update is not permitted for your role.'},403);
   const old=await env.DB.prepare('SELECT data FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?').bind(school,kind,id).first();if(!old)return out({error:'Not found.'},404);const previous=JSON.parse(old.data);
   if(kind==='notifications'){if(!['Read','Unread'].includes(b.status))return out({error:'Invalid notification status.'},400);if(!admin&&!['hr','finance','school'].includes(previous.target))return out({error:'This notification is not for this portal.'},403);data={...previous,status:b.status,read_at:b.status==='Read'?new Date().toISOString():null};}
   else if(kind==='orders'&&!admin){if(previous.status!=='Delivered'||!String(previous.office_note||'').includes('Center confirmation pending')||b.status!=='Delivered')return out({error:'Only a courier-delivered complete kit awaiting center confirmation can be confirmed.'},403);data={...previous,status:'Delivered',office_note:'Complete kit received and confirmed by center.',center_received_at:new Date().toISOString()};}
   else if(kind==='payroll'){if(!admin)return out({error:'Head office approval is required.'},403);const next=choice('status',['Approved','Paid']);if(next==='Approved'){if(previous.status!=='Draft'||previous.attendance_complete!==true)return out({error:'Only final-ready Draft payroll can be approved.'},409);data={...previous,status:'Approved',approved_at:new Date().toISOString()};}else{if(previous.status!=='Approved')return out({error:'Only Approved payroll can be paid.'},409);data={...previous,status:'Paid',paid_at:new Date().toISOString()};}}
   else if(kind==='salary_advances'){const next=choice('status',['Approved','Rejected','Released']);if(['Approved','Rejected'].includes(next)){if(previous.status!=='Pending')return out({error:'Only Pending advances can be reviewed.'},409);data={...previous,status:next,reviewed_at:new Date().toISOString()};}else{if(previous.status!=='Approved')return out({error:'Only Approved advances can be released.'},409);data={...previous,status:'Released',released_at:new Date().toISOString(),recovered_paise:Number(previous.recovered_paise||0),outstanding_paise:Math.max(0,Number(previous.amount_paise||0)-Number(previous.recovered_paise||0))};}}
   else if(kind==='staff_leave'){const next=choice('status',['Approved','Rejected']);if(previous.status!=='Pending')return out({error:'Only Pending leave can be reviewed.'},409);data={...previous,status:next,reviewed_at:new Date().toISOString()};}
   else if(kind==='students'){const classroom=await related('classrooms','classroom_id');if(classroom.program!==previous.program||classroom.academic_year!==previous.academic_year)fail('Classroom must match student class and academic year.');data={...previous,classroom_id:classroom.id};}
   else if(['homework','announcements'].includes(kind)){data={...previous,published:b.published===true};}
   else if(kind==='classrooms'){data={...previous,teacher:str('teacher'),name:str('name')};}
   else data={...previous,status:choice('status',kind==='enquiries'?['New','Contacted','Visit planned','Converted','Lost']:kind==='orders'?['Submitted','Approved','Dispatched','Delivered','Cancelled']:kind==='purchase_orders'?['Submitted','Approved','Dispatched','Cancelled']:kind==='ledger'?['Pending verification','Verified','Rejected']:['Open','In progress','Resolved']),office_note:str('office_note',1000,false),...(kind==='purchase_orders'&&b.status==='Approved'?{approved_at:new Date().toISOString()}: {})};
  }else{
   // Repeated submission IDs cannot create duplicate fees or orders.
   const existing=await env.DB.prepare('SELECT data FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?').bind(school,kind,recordId).first();
   if(existing)return out({error:'This submission already exists. Refresh records before retrying.'},409);
   if(kind==='teacher_tasks'){
    const teacher=await env.DB.prepare('SELECT account_id FROM neo_teacher_accounts WHERE school_id=? AND account_id=? AND active=1').bind(school,str('teacher_id',80)).first();if(!teacher)fail('Choose an active teacher in this school.');
    data={teacher_id:teacher.account_id,title:str('title'),due_date:date('due_date'),instructions:str('instructions',2000),status:'Pending',revision:1,history:[]};
   }else if(kind==='stock_items'){
    const reorder=Number(b.reorder_level??0);if(!Number.isInteger(reorder)||reorder<0||reorder>10000)fail('Reorder level must be 0â€“10000.');
    data={name:str('name'),category:choice('category',['Books','Student kits','Uniforms','Other']),size:str('size',80,false),reorder_level:reorder};
   }else if(kind==='stock_moves'){
    const item=await related('stock_items','item_id'),type=choice('type',['Receive','Issue to child','Adjustment in','Adjustment out']);
    if(!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>10000)fail('Quantity must be 1â€“10000.');
    const child=type==='Issue to child'?await related('students','student_id'):null;
    data={item_id:item.id,item_name:item.name,size:item.size,type,quantity:b.quantity,delta:['Receive','Adjustment in'].includes(type)?b.quantity:-b.quantity,student_id:child?.id||'',date:date('date'),reference:str('reference'),notes:str('notes',1000,false)};
    if(data.date>neoToday())fail('Stock date cannot be in the future.');
    if(type.startsWith('Adjustment')&&!data.notes)fail('A reason is required for stock adjustments.');
   }else if(kind==='vendors'){
    data={name:str('name',160),contact_person:str('contact_person',120,false),mobile:str('mobile',20,false),gstin:str('gstin',24,false).toUpperCase(),address:str('address',500,false),status:'Active'};
    if(data.mobile&&!/^\+?[0-9 ()-]{8,20}$/.test(data.mobile))fail('Check vendor mobile number.');
   }else if(kind==='purchase_orders'){
    const catalogId=str('central_product_id',80,false),catalog=catalogId?await supplyOne(env,'products',catalogId):null,vendor=catalog?{id:'HEAD_OFFICE',name:'Neo School India Head Office'}:await related('vendors','vendor_id'),quantity=Number(b.quantity),unit=catalog?Number(catalog.center_price_paise):Number(b.unit_price_paise),tax=Number(b.tax_paise||0),charges=Number(b.other_charges_paise||0);
    if(catalogId&&(!catalog||catalog.status!=='Active'||catalog.available_to_centers===false||!Number(catalog.center_price_paise)))fail('This Head Office catalogue item is unavailable. Refresh and choose again.');
    if(!Number.isInteger(quantity)||quantity<1||quantity>10000)fail('Quantity must be 1â€“10000.');
    if(!Number.isSafeInteger(unit)||unit<=0||unit>100000000)fail('Check unit price.');
    if(!Number.isSafeInteger(tax)||tax<0||!Number.isSafeInteger(charges)||charges<0)fail('Check tax and other charges.');
    const orderDate=date('order_date'),terms=choice('payment_terms',['Spot payment','Credit purchase']),creditDays=terms==='Credit purchase'?Number(b.credit_days):0;
    if(terms==='Credit purchase'&&(!Number.isInteger(creditDays)||creditDays<1||creditDays>365))fail('Credit days must be 1â€“365.');
    const total=quantity*unit+tax+charges;if(!Number.isSafeInteger(total)||total>1000000000)fail('Purchase total is too large.');
    const itemType=choice('item_type',['Inventory','Fixed asset']),category=catalog?(catalog.center_category||'Other'):choice('category',itemType==='Inventory'?['Student kits','Books','Uniforms','Stationery','Consumables','Other']:['Furniture','Computer lab','Electrical','Vehicle','Other']);
    if(catalog&&itemType!=='Inventory')fail('Head Office catalogue is only for inventory supply items.');
    data={po_no:'PO-'+orderDate.slice(0,4)+'-'+recordId.slice(-8).toUpperCase(),central_product_id:catalog?.id||'',vendor_id:vendor.id,vendor_name:vendor.name,item_type:itemType,category,item_name:catalog?.name||str('item_name',160),program:catalog?.program||(b.program?choice('program',['Playgroup','Nursery','LKG','UKG','Daycare','School-wide']):'School-wide'),size:catalog?.size||str('size',80,false),quantity,unit_price_paise:unit,tax_paise:tax,other_charges_paise:charges,total_paise:total,payment_terms:terms,credit_days:creditDays,order_date:orderDate,expected_date:date('expected_date'),destination:str('destination',160),payment_mode:terms==='Spot payment'?choice('payment_mode',['Cash','UPI','Bank transfer','Cheque']):'',notes:str('notes',1000,false),status:'Submitted',received_quantity:0};
    if(data.expected_date<data.order_date)fail('Expected delivery cannot be before order date.');
   }else if(kind==='goods_receipts'){
    const po=await related('purchase_orders','purchase_order_id');
    if(!['Approved','Dispatched'].includes(po.status))fail('Purchase Order must be Approved before receiving goods.');
    const quantity=Number(b.quantity),received=(await portalRows(env,school,'goods_receipts')).filter(x=>x.purchase_order_id===po.id).reduce((n,x)=>n+Number(x.quantity||0),0),remaining=Number(po.quantity||0)-received;
    if(!Number.isInteger(quantity)||quantity<1||quantity>remaining)fail('Received quantity exceeds the pending Purchase Order quantity.');
    const receiptDate=date('date');if(receiptDate>neoToday())fail('Goods receipt date cannot be in the future.');
    const value=Math.round(Number(po.total_paise||0)*quantity/Number(po.quantity||1));
    data={purchase_order_id:po.id,po_no:po.po_no,vendor_id:po.vendor_id,vendor_name:po.vendor_name,item_type:po.item_type,category:po.category,item_name:po.item_name,program:po.program,size:po.size,quantity,value_paise:value,date:receiptDate,supplier_invoice:str('supplier_invoice',160),delivery_reference:str('delivery_reference',160,false),condition:choice('condition',['Good','Partly damaged','Rejected']),damaged_quantity:Number(b.damaged_quantity||0),notes:str('notes',1000,false)};
    if(!Number.isInteger(data.damaged_quantity)||data.damaged_quantity<0||data.damaged_quantity>quantity)fail('Check damaged quantity.');
    if(data.condition!=='Good'&&!data.notes)fail('Add damage or rejection details.');
   }else if(kind==='vendor_payments'){
    const payable=await related('vendor_payables','payable_id'),amount=money(),paymentDate=date('date');
    if(amount>Number(payable.outstanding_paise||0))fail('Payment exceeds vendor outstanding amount.');
    if(paymentDate>neoToday())fail('Payment date cannot be in the future.');
    data={payable_id:payable.id,purchase_order_id:payable.purchase_order_id,vendor_id:payable.vendor_id,vendor_name:payable.vendor_name,amount_paise:amount,date:paymentDate,payment_mode:choice('payment_mode',['Cash','UPI','Bank transfer','Cheque']),reference:str('reference',200),notes:str('notes',1000,false),status:'Paid'};
   }else if(['assets','vendor_payables'].includes(kind))fail('This record is created automatically from procurement.');
   else if(kind==='classrooms'){
    if(!Number.isInteger(b.capacity)||b.capacity<1||b.capacity>200)fail('Capacity must be 1â€“200.');
    data={name:str('name'),program:choice('program',['Playgroup','Nursery','LKG','UKG','Daycare']),academic_year:str('academic_year',4),teacher:str('teacher'),capacity:b.capacity};if(!/^20[0-9]{2}$/.test(data.academic_year))fail('Enter a valid academic starting year.');
   }else if(kind==='fee_structures'){
    const classroom=await related('classrooms','classroom_id');data={classroom_id:classroom.id,title:str('title'),amount_paise:money(),due_date:date('due_date')};
   }else if(kind==='homework'){
    const classroom=await related('classrooms','classroom_id');data={classroom_id:classroom.id,title:str('title'),instructions:str('instructions',2000),subject:str('subject',80,false),topic:str('topic',200,false),homework_type:str('homework_type',80,false),due_date:date('due_date'),published:b.published===true};
   }else if(kind==='announcements'){
    const classroom=b.classroom_id?await related('classrooms','classroom_id'):null;data={classroom_id:classroom?.id||'',title:str('title'),category:str('category',80,false)||'General',audience:b.audience?choice('audience',['Parents and teachers','Teachers only']):'Parents and teachers',message:str('message',2000),published:b.published===true};
   }else if(kind==='students'){
    data={gender:b.gender?choice('gender',['Male','Female','Prefer not to say']):'',email:str('email',200,false),name:str('name'),dob:date('dob'),program:choice('program',['Playgroup','Nursery','LKG','UKG','Daycare']),parent:str('parent'),mobile:mobile(),academic_year:str('academic_year',9),previous_school:str('previous_school',200,false),previous_city:str('previous_city',120,false),nursery_status:choice('nursery_status',['Not applicable','Completed','In progress','Not attended']),lkg_status:choice('lkg_status',['Not applicable','Completed','In progress','Not attended'])};
    if(b.classroom_id){const classroom=await related('classrooms','classroom_id');if(classroom.program!==data.program||classroom.academic_year!==data.academic_year)fail('Classroom must match student class and academic year.');data.classroom_id=classroom.id;}
    if(data.dob>new Date().toISOString().slice(0,10))fail('DOB cannot be in the future.');
    if(!/^20[0-9]{2}$/.test(data.academic_year))fail('Enter the academic starting year.');
    if(['LKG','UKG'].includes(data.program)&&data.nursery_status==='Not applicable')fail('Specify previous Nursery status.');
    if(data.program==='UKG'&&data.lkg_status==='Not applicable')fail('Specify previous LKG status.');
    if([data.nursery_status,data.lkg_status].some(x=>['Completed','In progress'].includes(x))&&(!data.previous_school||!data.previous_city))fail('Enter previous school and city.');
   }else if(kind==='staff'){
  const departments=[
    'Teaching',
    'Administration',
    'Accounts',
    'HR',
    'Transport',
    'Inventory / Stores',
    'Maintenance / Housekeeping',
    'Security',
    'Other'
  ];

  const genders=[
    '',
    'Male',
    'Female',
    'Prefer not to say'
  ];

  const staffMobile=mobile();
  const emergency=str('emergency_mobile',20,false);
  const dob=str('dob',10,false);

  if(
    emergency &&
    !/^\+?[0-9 ()-]{8,20}$/.test(emergency)
  ) fail('Check emergency contact number.');

  if(dob){
    if(
      !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
      !Number.isFinite(Date.parse(dob)) ||
      new Date(dob).toISOString().slice(0,10)!==dob ||
      dob>neoToday()
    ) fail('Check date of birth.');
  }

  const startingSalary=Number.isSafeInteger(b.salary_paise)?b.salary_paise:0;
  if(startingSalary<0 || startingSalary>100000000) fail('Check monthly salary.');

  const duplicate=await env.DB.prepare(
    "SELECT id FROM neo_portal_records WHERE school_id=? AND kind='staff' AND json_extract(data,'$.mobile')=?"
  ).bind(
    school,
    staffMobile
  ).first();

  if(duplicate)
    fail('A staff record already uses this mobile number.');

  data={
    name:str('name',120),
    department:choice('department',departments),
    role:str('role',120),
    gender:genders.includes(b.gender||'')
      ? (b.gender||'')
      : fail('Invalid gender'),
    dob,
    mobile:staffMobile,
    email:str('email',160,false),
    joining_date:date('joining_date'),
    salary_paise:startingSalary,
    emergency_mobile:emergency,
    status:choice('status',['Active','Inactive'])
  };

}else if(kind==='staff_attendance'){
  const staffMember=await related('staff','staff_id');
  const tv=(k)=>{const v=str(k,5,false);if(v&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))fail('Check '+k.replaceAll('_',' ')+'.');return v};
  const attendanceStatus=choice('status',['Present','Absent','Leave','Half day']),checkIn=tv('check_in_time'),checkOut=tv('check_out_time');
  if(['Present','Half day'].includes(attendanceStatus)&&(!checkIn||!checkOut))fail('Check-in and check-out are required for Present / Half day.');
  if(checkIn&&checkOut&&checkOut<=checkIn)fail('Check-out must be after check-in.');
  data={staff_id:staffMember.id,date:date('date'),status:attendanceStatus,check_in_time:checkIn,check_out_time:checkOut};
  if(data.date>neoToday())fail('Staff attendance cannot be in the future.');
  recordId=staffMember.id+'_'+data.date;

}else if(kind==='payroll'){
  const staffMember=await related('staff','staff_id'),month=str('month',7);
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))fail('Check payroll month.');
  const salary=(await portalRows(env,school,'salary_setup')).filter(x=>x.staff_id===staffMember.id&&x.effective_from<=month+'-31').sort((a,b)=>String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  if(!salary)fail('Salary setup is required for this Staff ID.');
  const grossPaise=Number(salary.monthly_salary_paise||0);if(!Number.isSafeInteger(grossPaise)||grossPaise<=0)fail('Invalid salary setup.');
  const rules=(await portalRows(env,school,'hr_rules')).filter(x=>x.effective_from<=month+'-31').sort((a,b)=>String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  if(!rules)fail('HR rules must be configured before payroll.');
  const calendar=await portalRecord(env,school,'academic_calendar','academic-calendar');if(!calendar||calendar.status!=='Published')fail('Publish the Academic Calendar before payroll.');
  const working=(calendar.working_dates||[]).filter(d=>String(d).startsWith(month));if(!working.length)fail('No working dates found for this payroll month.');
  const today=neoToday(),due=working.filter(d=>d<=today),att=(await portalRows(env,school,'staff_attendance')).filter(x=>x.staff_id===staffMember.id&&working.includes(x.date)),am=new Map(att.map(x=>[x.date,x]));
  const leaves=(await portalRows(env,school,'staff_leave')).filter(x=>x.staff_id===staffMember.id&&x.status==='Approved'),leaveAt=d=>leaves.find(l=>l.from_date<=d&&l.to_date>=d);
  const marked=due.filter(d=>am.has(d)||leaveAt(d)),pending=Math.max(0,due.length-marked.length),tm=v=>{const q=String(v||'').split(':').map(Number);return q.length===2&&q.every(Number.isFinite)?q[0]*60+q[1]:NaN};
  const report=tm(rules.reporting_time||'09:00'),grace=Number(rules.grace_minutes||0);let late=0,absent=0,half=0,early=0;
  for(const d of due){const r=am.get(d);if(!r)continue;if(r.status==='Absent')absent++;if(r.status==='Half day')half++;if(['Present','Half day'].includes(r.status)&&Number.isFinite(tm(r.check_in_time))&&tm(r.check_in_time)>report+grace)late++;if(rules.early_exit_rule===true&&rules.closing_time&&['Present','Half day'].includes(r.status)&&Number.isFinite(tm(r.check_out_time))&&tm(r.check_out_time)<tm(rules.closing_time))early++;}
  const leaveDates=working.filter(d=>leaveAt(d)),unpaidBase=leaveDates.filter(d=>String(leaveAt(d)?.leave_type||'').toLowerCase().includes('unpaid')).length,paidCandidates=leaveDates.length-unpaidBase,paid=Math.min(paidCandidates,Number(rules.monthly_paid_leave||paidCandidates)),lop=unpaidBase+(rules.excess_leave_is_lop===true?Math.max(0,paidCandidates-paid):0);
  const lateDays=Math.floor(late/Number(rules.late_marks_count||1))*Number(rules.late_deduction_days||0),attendanceDays=absent*Number(rules.absent_deduction_days||0)+half*Number(rules.half_day_deduction_days||0)+lop,divisor=rules.salary_divisor==='working_days'?working.length:Number(rules.salary_divisor||30);if(!Number.isFinite(divisor)||divisor<=0)fail('Invalid salary divisor.');
  const rate=grossPaise/divisor,latePaise=Math.round(rate*lateDays),attendancePaise=Math.round(rate*attendanceDays);
  let advancePaise=0;for(const x of (await portalRows(env,school,'salary_advances')).filter(x=>x.staff_id===staffMember.id&&['Released','Partially Recovered'].includes(x.status))){const [sy,sm]=String(x.recovery_month||'').split('-').map(Number),[py,pm]=month.split('-').map(Number),n=Math.max(1,Number(x.installments||1)),off=(py-sy)*12+(pm-sm),outstanding=Number.isFinite(Number(x.outstanding_paise))?Number(x.outstanding_paise):Math.max(0,Number(x.amount_paise||0)-Number(x.recovered_paise||0));if(Number.isFinite(off)&&off>=0&&off<n&&outstanding>0)advancePaise+=Math.min(outstanding,Math.ceil(Number(x.amount_paise||0)/n));}
  const deductions=Math.min(grossPaise,latePaise+attendancePaise+advancePaise),net=Math.max(0,grossPaise-deductions),monthEnd=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0'),complete=monthEnd<today&&pending===0&&working.every(d=>am.has(d)||leaveAt(d)),now=new Date().toISOString();
  recordId=staffMember.id+'_'+month;const previous=await portalRecord(env,school,'payroll',recordId);
  if(previous&&['Approved','Paid'].includes(previous.status))fail('Approved or Paid payroll is locked and cannot be recalculated or overwritten.');
  data={staff_id:staffMember.id,month,gross_paise:grossPaise,late_deduction_paise:latePaise,attendance_deduction_paise:attendancePaise,advance_recovery_paise:advancePaise,deductions_paise:deductions,net_paise:net,deduction_days:lateDays+attendanceDays,late_mark_count:late,early_exit_count:early,absent_count:absent,half_day_count:half,paid_leave_count:paid,unpaid_leave_count:lop,attendance_marked_count:marked.length,expected_attendance_days:working.length,pending_attendance_count:pending,attendance_complete:complete,readiness_reason:monthEnd>=today?'Month still in progress':pending?pending+' attendance day(s) pending':'Attendance complete',salary_divisor_used:rules.salary_divisor==='working_days'?'Working days ('+working.length+')':String(divisor),calendar_status:calendar.status,salary_effective_from:salary.effective_from,hr_rules_effective_from:rules.effective_from,calculation:'Automatic',calculated_at:previous?.calculated_at||now,recalculated_at:previous?now:'',status:'Draft'};

}else if(kind==='salary_setup'){
  const staffMember=await related('staff','staff_id');

  if(
    !Number.isSafeInteger(b.monthly_salary_paise) ||
    b.monthly_salary_paise<=0 ||
    b.monthly_salary_paise>100000000
  ) fail('Check monthly salary.');

  const effectiveFrom=date('effective_from');
recordId=staffMember.id+'_'+effectiveFrom;
  data={
    staff_id:staffMember.id,
    monthly_salary_paise:b.monthly_salary_paise,
    effective_from:effectiveFrom,
    status:'Active'
  };

}else if(kind==='hr_rules'){
  const graceMinutes=Number(b.grace_minutes);
  const lateMarks=Number(b.late_marks_count);
  const lateDeduction=Number(b.late_deduction_days);
  const annualPaidLeave=Number(b.annual_paid_leave);
  const monthlyPaidLeave=Number(b.monthly_paid_leave);
  const halfDayDeduction=Number(b.half_day_deduction_days);
  const absentDeduction=Number(b.absent_deduction_days);
  const reportingTime=str('reporting_time',5),closingTime=str('closing_time',5),workingWeek=choice('working_week',['mon_fri','mon_sat','custom']),salaryDivisor=b.salary_divisor==='working_days'?'working_days':Number(b.salary_divisor);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(reportingTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(closingTime)||closingTime<=reportingTime)fail('Check reporting and closing times.');
  if(!(salaryDivisor==='working_days'||salaryDivisor===30))fail('Check salary divisor.');

  if(!Number.isInteger(graceMinutes) || graceMinutes<0 || graceMinutes>180)
    fail('Check grace minutes.');

  if(!Number.isInteger(lateMarks) || lateMarks<1 || lateMarks>31)
    fail('Check late marks count.');

  if(![0,0.25,0.5,1].includes(lateDeduction))
    fail('Check late mark deduction.');

  if(!Number.isInteger(annualPaidLeave) || annualPaidLeave<0 || annualPaidLeave>365)
    fail('Check annual paid leave.');

  if(!Number.isInteger(monthlyPaidLeave) || monthlyPaidLeave<0 || monthlyPaidLeave>31)
    fail('Check monthly paid leave.');

  if(![0,0.25,0.5,1].includes(halfDayDeduction))
    fail('Check half-day deduction.');

  if(![0,0.25,0.5,1].includes(absentDeduction))
    fail('Check absent deduction.');

  const effectiveFrom=date('effective_from');
recordId='HR_RULES_'+effectiveFrom;
  data={
    effective_from:effectiveFrom,
    working_week:workingWeek,reporting_time:reportingTime,closing_time:closingTime,salary_divisor:salaryDivisor,
    grace_minutes:graceMinutes,

    late_marks_count:lateMarks,
    late_deduction_days:lateDeduction,

    annual_paid_leave:annualPaidLeave,
    monthly_paid_leave:monthlyPaidLeave,

    half_day_deduction_days:halfDayDeduction,
    absent_deduction_days:absentDeduction,

    excess_leave_is_lop:b.excess_leave_is_lop===true,
    prefix_suffix_rule:b.prefix_suffix_rule===true,

    early_exit_rule:b.early_exit_rule===true,
    holiday_between_absence_is_lop:
      b.holiday_between_absence_is_lop===true,

    salary_deduction_automatic:true
  };
  }else if(kind==='staff_leave'){
  const staffMember=await related('staff','staff_id');
  const from=date('from_date');
  const to=date('to_date');

  if(to<from)
    fail('Leave end date cannot be before start date.');

  data={
    staff_id:staffMember.id,
    leave_type:choice(
      'leave_type',
      ['Casual','Sick','Earned','Unpaid','Other']
    ),
    from_date:from,
    to_date:to,
    reason:str('reason',1000),
    status:'Pending'
  };

}else if(kind==='salary_advances'){

  const staffMember=await related('staff','staff_id');

  if(
    !Number.isSafeInteger(b.amount_paise) ||
    b.amount_paise<=0 ||
    b.amount_paise>100000000
  ) fail('Check salary advance amount.');

  const installments=Number(b.installments||1);

  if(
    !Number.isInteger(installments) ||
    installments<1 ||
    installments>24
  ) fail('Installments must be 1â€“24.');

  data={
    staff_id:staffMember.id,
    amount_paise:b.amount_paise,
    request_date:date('request_date'),
    reason:str('reason',1000),
    recovery_month:str('recovery_month',7),
    installments,
    status:'Pending'
  };

  if(
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(
      data.recovery_month
    )
  ) fail('Check recovery month.');
  }else if(kind==='enquiries')data={name:str('name'),mobile:mobile(),child_name:str('child_name'),program:choice('program',['Playgroup','Nursery','LKG','UKG','Daycare']),follow_up:date('follow_up'),notes:str('notes',1000,false),status:'New'};
   else if(kind==='attendance'){const student=await related('students','student_id');data={student_id:student.id,date:date('date'),status:choice('status',['Present','Absent','Leave'])};if(data.date>new Date(Date.now()+330*60000).toISOString().slice(0,10))fail('Attendance cannot be in the future.');recordId=student.id+'_'+data.date;}
   else if(kind==='invoices'){const student=await related('students','student_id');data={student_id:student.id,title:str('title'),due_date:date('due_date'),amount_paise:money()};}
   else if(kind==='payments'){const invoice=await related('invoices','invoice_id'),paymentDate=date('date'),receiptNo=await nextFinanceNumber(env,school,'receipt',paymentDate);data={invoice_id:invoice.id,student_id:invoice.student_id,date:paymentDate,amount_paise:money(),method:choice('method',['Cash','UPI','Bank transfer','Cheque']),reference:str('reference',200),receipt_no:receiptNo,status:'Recorded by school'};if(data.date>new Date(Date.now()+330*60000).toISOString().slice(0,10))fail('Payment date cannot be in the future.');}
   else if(kind==='orders'){const quantity=b.quantity;if(!Number.isInteger(quantity)||quantity<1||quantity>1000)fail('Quantity must be 1â€“1000.');data={category:choice('category',['Books','Student kits','Uniforms']),item:str('item'),size:str('size',80,false),quantity,notes:str('notes',1000,false),status:'Submitted'};if(data.category==='Uniforms'&&!data.size)fail('Uniform size is required.');
    data.order_for=b.order_for?choice('order_for',['School stock','Classroom','Child']):'School stock';
    if(data.order_for==='Classroom'){const c=await related('classrooms','classroom_id');data.classroom_id=c.id;data.classroom_name=c.name;}
    if(data.order_for==='Child'){const c=await related('students','student_id');data.student_id=c.id;data.child_name=c.name;data.classroom_id=c.classroom_id||'';}
   }
   else if(kind==='vouchers'){const voucherDate=date(b.date?'date':'voucher_date');if(voucherDate>neoToday())fail('Voucher date cannot be in the future.');const voucherNo=await nextFinanceNumber(env,school,'voucher',voucherDate);data={voucher_no:voucherNo,date:voucherDate,category:str('category',120),paid_to:b.paid_to?str('paid_to',160):str('party',160),description:str('description',1000),amount_paise:money(),payment_mode:choice('payment_mode',['Cash','UPI','Bank transfer','Cheque','Other']),reference:str('reference',200,false),notes:str('notes',1000,false),source_kind:'manual_voucher',source_id:recordId,status:'Paid',created_by:admin?'head-office':'school:'+school,paid_at:new Date().toISOString()};}
   else if(kind==='daily_accounts')fail('Daily Ledger is read-only. Create the transaction in its receipt, voucher or source workflow.');
   else if(kind==='ledger')data={amount_paise:money(),date:date('date'),reference:str('reference'),notes:str('notes',1000,false),status:'Pending verification'};
   else if(kind==='support')data={subject:str('subject'),notes:str('notes',2000),status:'Open'};
  }
  let sql='INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)';
 if(
  request.method==='PATCH' ||
  ['attendance','staff_attendance','salary_setup','hr_rules','payroll'].includes(kind)
){
  sql+=' ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data';
}
  const writes=[env.DB.prepare(sql).bind(school,kind,recordId,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,admin?'head-office':'school:'+school,request.method+':'+kind,recordId)];
  if(kind==='students'&&data.classroom_id){
   const fees=(await portalRows(env,school,'fee_structures')).filter(f=>f.classroom_id===data.classroom_id);
   if(fees.length>80)fail('Too many fee structures for automatic assignment. Contact head office.');
   for(const fee of fees)writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'invoices','FS_'+fee.id+'_'+recordId,JSON.stringify({student_id:recordId,title:fee.title,due_date:fee.due_date,amount_paise:fee.amount_paise,fee_structure_id:fee.id})));
  }
  if(kind==='fee_structures'){
   const children=(await portalRows(env,school,'students')).filter(c=>c.classroom_id===data.classroom_id);
   if(children.length>80)fail('This class exceeds the automatic fee assignment limit of 80. Split into classroom sections.');
   for(const child of children)writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'invoices','FS_'+recordId+'_'+child.id,JSON.stringify({student_id:child.id,title:data.title,due_date:data.due_date,amount_paise:data.amount_paise,fee_structure_id:recordId})));
  }
  if(kind==='goods_receipts'&&request.method==='POST'){
   const po=await portalRecord(env,school,'purchase_orders',data.purchase_order_id),accepted=Math.max(0,Number(data.quantity||0)-Number(data.damaged_quantity||0));
   if(accepted<1)fail('At least one accepted item is required. Record a fully rejected delivery in the Purchase Order note.');
   const acceptedValue=Math.round(Number(po.total_paise||0)*accepted/Number(po.quantity||1)),prior=(await portalRows(env,school,'goods_receipts')).filter(x=>x.purchase_order_id===po.id).reduce((n,x)=>n+Number(x.quantity||0),0),nextReceived=prior+Number(data.quantity||0),nextPo={...po,received_quantity:nextReceived,status:nextReceived>=Number(po.quantity||0)?'Delivered':po.status};delete nextPo.id;delete nextPo.created_at;
   writes.push(env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'purchase_orders',?,?) ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data").bind(school,po.id,JSON.stringify(nextPo)));
   if(po.item_type==='Inventory'){
    const itemId='POITEM_'+po.id,stockItem={name:po.item_name,category:['Books','Student kits','Uniforms'].includes(po.category)?po.category:'Other',size:[po.program,po.size].filter(Boolean).join(' Â· '),reorder_level:0,source_kind:'purchase_order',source_id:po.id};
    writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'stock_items',?,?)").bind(school,itemId,JSON.stringify(stockItem)));
    writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'stock_moves',?,?)").bind(school,'GRN_MOVE_'+recordId,JSON.stringify({item_id:itemId,item_name:po.item_name,size:stockItem.size,type:'Purchase receive',quantity:accepted,delta:accepted,student_id:'',date:data.date,reference:data.supplier_invoice,notes:'Automatic stock receipt from '+po.po_no,source_kind:'goods_receipt',source_id:recordId})));
   }else{
    for(let i=1;i<=accepted;i++){const assetId='ASSET_'+recordId+'_'+String(i).padStart(3,'0');writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'assets',?,?)").bind(school,assetId,JSON.stringify({asset_tag:assetId,item_name:po.item_name,category:po.category,location:po.destination,purchase_order_id:po.id,goods_receipt_id:recordId,vendor_id:po.vendor_id,vendor_name:po.vendor_name,purchase_date:data.date,purchase_value_paise:Math.round(acceptedValue/accepted),condition:data.condition,status:'In use'})));}
   }
   if(po.payment_terms==='Spot payment'){
    const accounts=await portalRows(env,school,'daily_accounts'),available=accounts.reduce((n,x)=>n+(x.direction==='IN'?1:-1)*Number(x.amount_paise||0),0);if(acceptedValue>available)fail('Insufficient available balance for this spot payment. Receive against credit terms or record sufficient funds first.');
    const voucherId='PUR_'+recordId,voucherNo=await nextFinanceNumber(env,school,'voucher',data.date),voucher={voucher_no:voucherNo,date:data.date,category:'Purchase & inventory Â· '+po.category,paid_to:po.vendor_name,description:po.item_name+' Â· '+accepted+' received against '+po.po_no,amount_paise:acceptedValue,payment_mode:po.payment_mode,reference:data.supplier_invoice,notes:'System generated from goods receipt',source_kind:'goods_receipt',source_id:recordId,status:'Paid',created_by:'system',paid_at:new Date().toISOString()};
    writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'vouchers',?,?)").bind(school,voucherId,JSON.stringify(voucher)));
    writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'daily_accounts',?,?)").bind(school,'FIN_PUR_'+recordId,JSON.stringify({direction:'OUT',category:voucher.category,amount_paise:acceptedValue,transaction_date:data.date,payment_mode:po.payment_mode,party:po.vendor_name,reference:voucherNo,notes:voucher.description,source_kind:'voucher',source_id:voucherId,status:'Posted'})));
   }else{
    const due=new Date(data.date+'T00:00:00Z');due.setUTCDate(due.getUTCDate()+Number(po.credit_days||0));writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'vendor_payables',?,?)").bind(school,'PAYABLE_'+recordId,JSON.stringify({purchase_order_id:po.id,goods_receipt_id:recordId,vendor_id:po.vendor_id,vendor_name:po.vendor_name,invoice_no:data.supplier_invoice,amount_paise:acceptedValue,paid_paise:0,outstanding_paise:acceptedValue,due_date:due.toISOString().slice(0,10),status:'Outstanding'})));
   }
  }
  if(kind==='vendor_payments'&&request.method==='POST'){
   const payable=await portalRecord(env,school,'vendor_payables',data.payable_id),accounts=await portalRows(env,school,'daily_accounts'),available=accounts.reduce((n,x)=>n+(x.direction==='IN'?1:-1)*Number(x.amount_paise||0),0);if(data.amount_paise>available)fail('Insufficient available balance for this vendor payment.');
   const nextPaid=Number(payable.paid_paise||0)+data.amount_paise,nextOutstanding=Math.max(0,Number(payable.amount_paise||0)-nextPaid),next={...payable,paid_paise:nextPaid,outstanding_paise:nextOutstanding,status:nextOutstanding?'Part paid':'Paid'};delete next.id;delete next.created_at;
   writes.push(env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'vendor_payables',?,?) ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data").bind(school,payable.id,JSON.stringify(next)));
   const voucherId='VENDOR_'+recordId,voucherNo=await nextFinanceNumber(env,school,'voucher',data.date),voucher={voucher_no:voucherNo,date:data.date,category:'Purchase & inventory Â· Vendor payment',paid_to:payable.vendor_name,description:'Credit purchase payment',amount_paise:data.amount_paise,payment_mode:data.payment_mode,reference:data.reference,notes:data.notes,source_kind:'vendor_payment',source_id:recordId,status:'Paid',created_by:'system',paid_at:new Date().toISOString()};
   writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'vouchers',?,?)").bind(school,voucherId,JSON.stringify(voucher)));
   writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'daily_accounts',?,?)").bind(school,'FIN_VENDOR_'+recordId,JSON.stringify({direction:'OUT',category:voucher.category,amount_paise:data.amount_paise,transaction_date:data.date,payment_mode:data.payment_mode,party:payable.vendor_name,reference:voucherNo,notes:voucher.description,source_kind:'voucher',source_id:voucherId,status:'Posted'})));
  }
  if(kind==='payments'&&request.method==='POST'){const finId='FIN_FEE_'+recordId,student=await portalRecord(env,school,'students',data.student_id);writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'daily_accounts',finId,JSON.stringify({direction:'IN',category:'Fee collection',amount_paise:data.amount_paise,transaction_date:data.date,payment_mode:data.method,party:student?.name||data.student_id,reference:data.receipt_no,notes:'Automatic posting from fee receipt',source_kind:'fee_payment',source_id:recordId,status:'Posted'})));}
  if(kind==='vouchers'&&request.method==='POST'){const finId='FIN_VCH_'+recordId;writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'daily_accounts',finId,JSON.stringify({direction:'OUT',category:data.category,amount_paise:data.amount_paise,transaction_date:data.date,payment_mode:data.payment_mode,party:data.paid_to,reference:data.voucher_no,notes:data.description,source_kind:'voucher',source_id:recordId,status:'Posted'})));}
  if(kind==='ledger'&&request.method==='POST'){
   const voucherId='HO_'+recordId,voucherNo=await nextFinanceNumber(env,school,'voucher',data.date);
   const voucher=headOfficePaymentVoucher(data,recordId,voucherNo);
   writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'vouchers',?,?)").bind(school,voucherId,JSON.stringify(voucher)));
   writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'daily_accounts',?,?)").bind(school,'FIN_HO_'+recordId,JSON.stringify(headOfficePaymentPosting(data,voucherId,voucherNo))));
  }
  if(kind==='staff_leave'&&request.method==='PATCH'&&['Approved','Rejected'].includes(data.status))writes.push(portalNotification(env,school,'staff:'+data.staff_id,'Leave '+data.status,'Your leave request was '+data.status.toLowerCase()+'.','staff_leave',recordId,'Unread','employee_hub'));
  if(kind==='salary_advances'&&request.method==='PATCH'&&['Approved','Rejected','Released'].includes(data.status))writes.push(portalNotification(env,school,'staff:'+data.staff_id,'Salary advance '+data.status,data.status==='Released'?'Your approved salary advance has been released.':'Your salary advance request was '+data.status.toLowerCase()+'.','salary_advances',recordId,'Unread','employee_hub'));
  if(kind==='salary_advances'&&request.method==='PATCH'&&data.status==='Approved')writes.push(portalNotification(env,school,'finance','Salary advance ready for release','HR approved a salary advance. Finance release is pending.','salary_advances',recordId,'Unread','hr_workflow'));
  if(kind==='salary_advances'&&request.method==='PATCH'&&data.status==='Released'){const finId='FIN_ADV_'+recordId,voucherId='ADV_'+recordId,voucherNo=await nextFinanceNumber(env,school,'voucher',neoToday()),member=await portalRecord(env,school,'staff',data.staff_id),voucher={voucher_no:voucherNo,date:neoToday(),category:'Salary advance',paid_to:member?.name||data.staff_id,description:'Salary advance release',amount_paise:data.amount_paise,payment_mode:'Other',reference:recordId,notes:'System generated from approved salary advance',source_kind:'salary_advance',source_id:recordId,status:'Paid',created_by:'system',paid_at:new Date().toISOString()};writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'vouchers',voucherId,JSON.stringify(voucher)));writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'daily_accounts',finId,JSON.stringify({direction:'OUT',category:'Salary advance',amount_paise:data.amount_paise,transaction_date:neoToday(),payment_mode:'Other',party:member?.name||data.staff_id,reference:voucherNo,notes:'Automatic posting from salary advance release',source_kind:'voucher',source_id:voucherId,status:'Posted'})));}
  if(kind==='payroll'&&request.method==='PATCH'&&data.status==='Paid'){writes.push(portalNotification(env,school,'staff:'+data.staff_id,'Salary paid','Your salary for '+data.month+' has been paid. Your payslip is now available.','payroll',recordId,'Unread','employee_hub'));const finId='FIN_PAY_'+recordId,voucherId='PAY_'+recordId,voucherNo=await nextFinanceNumber(env,school,'voucher',neoToday()),member=await portalRecord(env,school,'staff',data.staff_id),voucher={voucher_no:voucherNo,date:neoToday(),category:'Salary payment',paid_to:member?.name||data.staff_id,description:'Salary payment for '+data.month,amount_paise:data.net_paise,payment_mode:'Other',reference:recordId,notes:'System generated from paid payroll',source_kind:'payroll',source_id:recordId,status:'Paid',created_by:'system',paid_at:new Date().toISOString()};writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'vouchers',voucherId,JSON.stringify(voucher)));writes.push(env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'daily_accounts',finId,JSON.stringify({direction:'OUT',category:'Salary payment',amount_paise:data.net_paise,transaction_date:neoToday(),payment_mode:'Other',party:member?.name||data.staff_id,reference:voucherNo,notes:'Automatic posting from paid payroll',source_kind:'voucher',source_id:voucherId,status:'Posted'})));if(Number(data.advance_recovery_paise||0)>0){let remaining=Number(data.advance_recovery_paise);const advances=(await portalRows(env,school,'salary_advances')).filter(x=>x.staff_id===data.staff_id&&['Released','Partially Recovered'].includes(x.status)).sort((a,b)=>String(a.recovery_month).localeCompare(String(b.recovery_month))||String(a.created_at).localeCompare(String(b.created_at)));for(const adv of advances){if(remaining<=0)break;const recovered=Number(adv.recovered_paise||0),outstanding=Number.isFinite(Number(adv.outstanding_paise))?Number(adv.outstanding_paise):Math.max(0,Number(adv.amount_paise||0)-recovered),take=Math.min(outstanding,remaining);if(take<=0)continue;const nextRecovered=recovered+take,nextOutstanding=Math.max(0,Number(adv.amount_paise||0)-nextRecovered),next={...adv,recovered_paise:nextRecovered,outstanding_paise:nextOutstanding,status:nextOutstanding===0?'Recovered':'Partially Recovered',last_recovery_payroll_id:recordId,last_recovery_at:new Date().toISOString()};delete next.id;delete next.created_at;writes.push(env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'salary_advances',?,?) ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data").bind(school,adv.id,JSON.stringify(next)));writes.push(portalNotification(env,school,'staff:'+data.staff_id,next.status==='Recovered'?'Salary advance recovered':'Salary advance recovery posted',next.status==='Recovered'?'Your salary advance has been fully recovered.':'A payroll recovery was posted. Outstanding: '+(nextOutstanding/100).toFixed(2)+' INR.','salary_advances',adv.id,'Unread','employee_hub'));remaining-=take;}}}
  await env.DB.batch(writes);
  if(kind==='orders'&&request.method==='PATCH'&&data.center_received_at)await reconcileCenterSupplyReceipts(env,school,[{...data,id:recordId}]);
  return out({success:true,id:recordId},request.method==='POST'?201:200);
 }catch(e){if(e instanceof TypeError)return out({error:e.message},400);if(String(e.message).includes('NEO_INSUFFICIENT_STOCK'))return out({error:'Not enough stock. Refresh the stock balance before issuing.'},409);if(String(e.message).includes('UNIQUE constraint'))return out({error:'This submission already exists. Refresh before retrying.'},409);if(String(e.message).includes('PORTAL_PAYMENT_EXCEEDS_BALANCE'))return out({error:'Payment exceeds the remaining fee balance. Refresh and check the amount.'},409);console.error('Portal error',e);return out({error:'School records could not be loaded or saved. Retry; if this continues, ask head office to check the deployed CRM Worker and its DB binding.',code:'PORTAL_UNAVAILABLE'},503);}
}

// Additive setup is retried after failure and automatically runs on first authenticated use.
const portalSchemaReady=new WeakMap();
async function ensurePortalSchema(env){
 if(!portalSchemaReady.has(env.DB)){const promise=env.DB.batch(PORTAL_SCHEMA.map(sql=>env.DB.prepare(sql))).catch(e=>{portalSchemaReady.delete(env.DB);throw e});portalSchemaReady.set(env.DB,promise)}
 await portalSchemaReady.get(env.DB);
}
async function nextFinanceNumber(env,school,docType,docDate){
 const year=String(docDate||neoToday()).slice(0,4);
 if(!['receipt','voucher'].includes(docType)||!/^20\d{2}$/.test(year))throw new TypeError('Invalid finance document sequence.');
 const row=await env.DB.prepare(`INSERT INTO neo_finance_sequences(school_id,doc_type,year,last_no) VALUES (?,?,?,1) ON CONFLICT(school_id,doc_type,year) DO UPDATE SET last_no=last_no+1 RETURNING last_no`).bind(school,docType,year).first();
 const n=Number(row?.last_no);if(!Number.isSafeInteger(n)||n<1)throw new Error('Finance document number could not be generated.');
 return (docType==='receipt'?'RCPT':'PV')+'-'+year+'-'+String(n).padStart(6,'0');
}
async function portalRows(env,school,kind){const r=await env.DB.prepare('SELECT id,data,created_at FROM neo_portal_records WHERE school_id=? AND kind=? ORDER BY created_at DESC,id').bind(school,kind).all();return (r.results||[]).map(x=>({...JSON.parse(x.data),id:x.id,created_at:x.created_at}))}
async function portalRecord(env,school,kind,id){const r=await env.DB.prepare('SELECT data FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?').bind(school,kind,id).first();return r?{...JSON.parse(r.data),id}:null}
function headOfficePaymentVoucher(payment,paymentId,voucherNo){
 return {voucher_no:voucherNo,date:payment.date,category:'Head Office Â· Payment',paid_to:'Head Office',description:payment.notes?'Payment to Head Office Â· '+payment.notes:'Payment to Head Office',amount_paise:payment.amount_paise,payment_mode:'Other',reference:payment.reference,notes:'Recorded by school; Head Office verification: '+payment.status,source_kind:'head_office_payment',source_id:paymentId,status:'Paid',created_by:'system',paid_at:payment.created_at||new Date().toISOString()};
}
function headOfficePaymentPosting(payment,voucherId,voucherNo){
 return {direction:'OUT',category:'Head Office Â· Payment',amount_paise:payment.amount_paise,transaction_date:payment.date,payment_mode:'Other',party:'Head Office',reference:voucherNo,notes:payment.notes?'Head Office payment Â· '+payment.notes:'Payment to Head Office',source_kind:'voucher',source_id:voucherId,status:'Posted'};
}
async function reconcileHeadOfficePayments(env,school){
 const payments=await portalRows(env,school,'ledger');
 if(!payments.length)return;
 const writes=[];
 for(const payment of payments){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(payment.date||''))||!Number.isSafeInteger(Number(payment.amount_paise))||Number(payment.amount_paise)<=0)continue;
  const voucherId='HO_'+payment.id,postingId='FIN_HO_'+payment.id;
  const [existingVoucher,existingPosting]=await Promise.all([portalRecord(env,school,'vouchers',voucherId),portalRecord(env,school,'daily_accounts',postingId)]);
  if(existingVoucher&&existingPosting)continue;
  const voucherNo=existingVoucher?.voucher_no||await nextFinanceNumber(env,school,'voucher',payment.date);
  if(!existingVoucher)writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'vouchers',?,?)").bind(school,voucherId,JSON.stringify(headOfficePaymentVoucher(payment,payment.id,voucherNo))));
  if(!existingPosting)writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'daily_accounts',?,?)").bind(school,postingId,JSON.stringify(headOfficePaymentPosting(payment,voucherId,voucherNo))));
 }
 if(writes.length)await env.DB.batch(writes);
}
async function reconcileCenterSupplyReceipts(env,school,onlyOrders){
 await ensureSupplySchema(env);
 const orders=onlyOrders||(await portalRows(env,school,'orders')).filter(x=>x.center_received_at&&String(x.office_note||'').includes('confirmed by center'));
 if(!orders.length)return 0;
 const [packs,shipments]=await Promise.all([supplyRows(env,'packs'),supplyRows(env,'shipments')]);
 const deliveredPackIds=new Set(shipments.filter(x=>x.school_id===school&&x.status==='Delivered').map(x=>x.pack_id));
 const writes=[];
 for(const order of orders){
  const receivedAt=String(order.center_received_at||new Date().toISOString()),receivedDate=receivedAt.slice(0,10)||neoToday();
  const deliveredPacks=packs.filter(x=>x.school_id===school&&x.center_order_id===order.id&&deliveredPackIds.has(x.id));if(!deliveredPacks.length)continue;
  const quantity=Number(order.quantity||1);if(!Number.isInteger(quantity)||quantity<1)continue;
  const kitName=String(order.item||order.item_name||'Complete Student Kit').trim(),itemId='HOKIT_'+kitName.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64);
  const size=String(order.size||''),stockItem={name:kitName,category:'Student kits',size,reorder_level:0,source_kind:'head_office_complete_kit',source_id:itemId,bom_item_count:deliveredPacks.length};
  const awb=shipments.find(x=>x.school_id===school&&x.status==='Delivered'&&deliveredPacks.some(p=>p.id===x.pack_id))?.awb_no||order.id;
  const movement={item_id:itemId,item_name:kitName,size,type:'Complete kit received',quantity,delta:quantity,student_id:order.student_id||'',date:receivedDate,reference:awb,notes:'One sealed complete kit received from Head Office. Contents remain traceable in the kit BOM.',source_kind:'center_complete_kit_receipt',source_id:order.id,bom_item_count:deliveredPacks.length};
  writes.push(env.DB.prepare("DELETE FROM neo_portal_records WHERE school_id=? AND kind='stock_moves' AND json_extract(data,'$.source_kind')='center_order_receipt' AND json_extract(data,'$.source_id')=?").bind(school,order.id));
  writes.push(env.DB.prepare("DELETE FROM neo_portal_records WHERE school_id=? AND kind='stock_items' AND json_extract(data,'$.source_kind')='head_office_supply' AND NOT EXISTS (SELECT 1 FROM neo_portal_records m WHERE m.school_id=? AND m.kind='stock_moves' AND json_extract(m.data,'$.item_id')=neo_portal_records.id)").bind(school,school));
  writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'stock_items',?,?)").bind(school,itemId,JSON.stringify(stockItem)));
  writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'stock_moves',?,?)").bind(school,'HOKIT_RECEIPT_'+order.id,JSON.stringify(movement)));
 }
 if(writes.length)await env.DB.batch(writes);
 return writes.length/4;
}
async function portalExtra(request,env,url,admin,session){
 const out=(b,status=200)=>json(b,status,request);
 if(url.pathname==='/api/portal/overview'&&request.method==='GET'){
  if(!admin)return out({error:'Head-office access required.'},403);
  const schools=(await env.DB.prepare('SELECT school_id,name,city,active FROM neo_schools ORDER BY name').all()).results||[];
  const rows=(await env.DB.prepare('SELECT school_id,kind,id,data,created_at FROM neo_portal_records').all()).results||[];
  const decoded=rows.map(r=>({...JSON.parse(r.data),id:r.id,school_id:r.school_id,kind:r.kind,created_at:r.created_at}));
  const today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
  return out({schools:schools.map(s=>{const own=decoded.filter(r=>r.school_id===s.school_id);const students=own.filter(r=>r.kind==='students').length,attendance=own.filter(r=>r.kind==='attendance'&&r.date===today);return {...s,students,attendance_marked:attendance.length,present:attendance.filter(r=>r.status==='Present').length,fees_charged:own.filter(r=>r.kind==='invoices').reduce((n,r)=>n+r.amount_paise,0),fees_collected:own.filter(r=>r.kind==='payments').reduce((n,r)=>n+r.amount_paise,0),parent_concerns:own.filter(r=>r.kind==='parent_tickets'&&!['Resolved','Closed'].includes(r.status)).length,pending_orders:own.filter(r=>r.kind==='orders'&&!['Delivered','Cancelled'].includes(r.status)).length,open_support:own.filter(r=>r.kind==='support'&&r.status!=='Resolved').length}}),orders:decoded.filter(r=>r.kind==='orders').sort((a,b)=>b.created_at.localeCompare(a.created_at)),date:today});
 }
 const m=url.pathname.match(/^\/api\/portal\/([^/]+)\/(parent_access|teacher_access|apply_fees)(?:\/([^/]+))?$/);
 if(!m)return null;
 const [,school,kind,id]=m;
 if(!admin&&session.school_id!==school)return out({error:'Access denied.'},403);
 if(kind==='teacher_access'&&request.method==='GET'){
  const r=await env.DB.prepare(`SELECT e.account_id,e.name,e.staff_id,e.staff_type,e.active,a.classroom_ids FROM neo_employee_accounts e LEFT JOIN neo_teacher_accounts a ON a.account_id=e.account_id AND a.school_id=e.school_id WHERE e.school_id=?`).bind(school).all();
  return out({accounts:(r.results||[]).map(x=>({...x,classroom_ids:JSON.parse(x.classroom_ids||'[]')}))});
 }
 if(kind==='parent_access'&&request.method==='GET'){
  const r=await env.DB.prepare('SELECT account_id,student_id,active FROM neo_parent_accounts WHERE school_id=?').bind(school).all();return out({accounts:r.results||[]});
 }
 if(request.method!=='POST')return out({error:'Method not allowed.'},405);
 let b;try{b=await request.json()}catch{return out({error:'Invalid JSON.'},400)}
 if(kind==='teacher_access'){
  const old=id?await env.DB.prepare('SELECT account_id FROM neo_employee_accounts WHERE school_id=? AND account_id=?').bind(school,id).first():null;
  if(id&&!old)return out({error:'Teacher not found.'},404);
  if(b?.disable===true){if(!old)return out({error:'Teacher not found.'},404);await env.DB.batch([env.DB.prepare('UPDATE neo_employee_accounts SET active=0 WHERE school_id=? AND account_id=?').bind(school,id),env.DB.prepare('UPDATE neo_teacher_accounts SET active=0 WHERE school_id=? AND account_id=?').bind(school,id),portalAudit(env,school,admin,'disable-employee-access',id)]);return out({success:true})}
  if(!strongPortalPassword(b?.password)||!Array.isArray(b?.classroom_ids)||b.classroom_ids.length>20)return out({error:'Use an 8â€“128 character password with uppercase, lowercase, number and symbol.'},400);
  for(const cid of b.classroom_ids){if(typeof cid!=='string'||!await portalRecord(env,school,'classrooms',cid))return out({error:'Select classrooms from this school.'},400)}

  let staffMember=null,staffId=typeof b?.staff_id==='string'?b.staff_id.trim():'';
  let newStaffData=null;
  if(staffId){
    staffMember=await portalRecord(env,school,'staff',staffId);
    if(!staffMember||staffMember.status==='Inactive')return out({error:'Choose an active Staff ID from this school.'},400);
    const existingCategory=staffMember.staff_type||staffMember.staff_category||(staffMember.department==='Teaching'?'Teaching Staff':'');
    if(b.classroom_ids.length&&existingCategory!=='Teaching Staff')return out({error:'Classroom access can be assigned only to Teaching Staff.'},400);
  }else{
    const p=b?.teacher_profile&&typeof b.teacher_profile==='object'&&!Array.isArray(b.teacher_profile)?b.teacher_profile:{};
    const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
    const name=clean(p.name,120),role=clean(p.role,120),staffCategory=clean(p.staff_type,40),mobile=clean(p.mobile,20).replace(/\s+/g,''),email=clean(p.email,160),joining=clean(p.joining_date,10);
    const allowedCategories=['Teaching Staff','Administrative Staff','Support Staff'];
    if(!name||!role||!allowedCategories.includes(staffCategory)||!/^\+?[0-9]{10,15}$/.test(mobile)||!/^\d{4}-\d{2}-\d{2}$/.test(joining)||!Number.isFinite(Date.parse(joining))||new Date(joining).toISOString().slice(0,10)!==joining)return out({error:'Enter employee name, staff category, role, valid mobile and joining date.'},400);
    const duplicate=await env.DB.prepare("SELECT id FROM neo_portal_records WHERE school_id=? AND kind='staff' AND json_extract(data,'$.mobile')=?").bind(school,mobile).first();
    if(duplicate)return out({error:'A staff record already uses this mobile number. Use the existing teacher record instead of creating a duplicate.'},409);
    staffId='NEO'+String(new Date().getFullYear()).slice(-2)+crypto.randomUUID().replace(/-/g,'').slice(0,4).toUpperCase();
    const department=staffCategory==='Teaching Staff'?'Teaching':staffCategory==='Administrative Staff'?'Administration':'Other';
    newStaffData={name,staff_type:staffCategory,department,role,gender:'',dob:'',mobile,email,joining_date:joining,salary_paise:0,emergency_mobile:'',status:'Active'};
    staffMember={...newStaffData,id:staffId};
  }

  const effectiveCategory=staffMember.staff_type||staffMember.staff_category||(staffMember.department==='Teaching'?'Teaching Staff':'');
  const isTeaching=effectiveCategory==='Teaching Staff';
  if(!isTeaching&&b.classroom_ids.length)return out({error:'Classroom access can be assigned only to Teaching Staff.'},400);
  const existingEmployee=await env.DB.prepare('SELECT account_id FROM neo_employee_accounts WHERE school_id=? AND staff_id=?').bind(school,staffId).first();
  const linked=isTeaching?await env.DB.prepare('SELECT account_id FROM neo_teacher_staff_links WHERE school_id=? AND staff_id=?').bind(school,staffId).first():null;
  if(linked&&old&&linked.account_id!==old.account_id)return out({error:'This Staff ID is already linked to another teacher account.'},409);
  const account=old?.account_id||existingEmployee?.account_id||linked?.account_id||'NT-'+crypto.randomUUID().slice(0,12).toUpperCase();
  const salt=crypto.randomUUID(),hash=await schoolPassword(b.password,salt);
  const writes=[];
  if(newStaffData){
    writes.push(env.DB.prepare('INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'staff',staffId,JSON.stringify(newStaffData)));
    writes.push(portalAudit(env,school,admin,'POST:staff',staffId));
  }
  writes.push(env.DB.prepare(`INSERT INTO neo_employee_accounts(account_id,school_id,staff_id,name,staff_type,password_hash,salt,active) VALUES (?,?,?,?,?,?,?,1) ON CONFLICT(account_id) DO UPDATE SET staff_id=excluded.staff_id,name=excluded.name,staff_type=excluded.staff_type,password_hash=excluded.password_hash,salt=excluded.salt,active=1`).bind(account,school,staffId,staffMember.name,effectiveCategory,hash,salt));
  if(isTeaching)writes.push(
    env.DB.prepare(`INSERT INTO neo_teacher_accounts(account_id,school_id,name,classroom_ids,password_hash,salt,active) VALUES (?,?,?,?,?,?,1) ON CONFLICT(account_id) DO UPDATE SET name=excluded.name,classroom_ids=excluded.classroom_ids,password_hash=excluded.password_hash,salt=excluded.salt,active=1`).bind(account,school,staffMember.name,JSON.stringify([...new Set(b.classroom_ids)]),hash,salt),
    env.DB.prepare(`INSERT INTO neo_teacher_staff_links(account_id,school_id,staff_id) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET school_id=excluded.school_id,staff_id=excluded.staff_id`).bind(account,school,staffId)
  );
  writes.push(portalAudit(env,school,admin,newStaffData?'create-employee-and-access':'set-employee-access',account));
  await env.DB.batch(writes);
  return out({success:true,account_id:account,staff_id:staffId,staff_created:!!newStaffData,salary_setup_status:newStaffData?'Pending HR setup':'Existing staff',academic_access:isTeaching?'Teacher login active':'Employee self-service active'});
 }
 if(kind==='parent_access'){
  const child=await portalRecord(env,school,'students',id);if(!child)return out({error:'Student not found.'},404);
  const old=await env.DB.prepare('SELECT account_id FROM neo_parent_accounts WHERE school_id=? AND student_id=?').bind(school,id).first();
  if(b?.disable===true){if(!old)return out({error:'Parent account not found.'},404);await env.DB.batch([env.DB.prepare('UPDATE neo_parent_accounts SET active=0 WHERE school_id=? AND student_id=?').bind(school,id),portalAudit(env,school,admin,'disable-parent-access',id)]);return out({success:true})}
  if(!strongPortalPassword(b?.password))return out({error:'Choose a password of 8â€“128 characters with uppercase, lowercase, number and symbol.'},400);
  const salt=crypto.randomUUID(),hash=await schoolPassword(b.password,salt),account=old?.account_id||'NP-'+crypto.randomUUID().slice(0,12).toUpperCase();
  await env.DB.batch([env.DB.prepare('INSERT INTO neo_parent_accounts(account_id,school_id,student_id,password_hash,salt,active) VALUES (?,?,?,?,?,1) ON CONFLICT(school_id,student_id) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt,active=1').bind(account,school,id,hash,salt),portalAudit(env,school,admin,'set-parent-access',id)]);
  return out({success:true,account_id:account});
 }
 const fee=await portalRecord(env,school,'fee_structures',id);if(!fee)return out({error:'Fee structure not found.'},404);
 const students=(await portalRows(env,school,'students')).filter(s=>s.classroom_id===fee.classroom_id);
 if(!students.length)return out({error:'Assign students to this classroom first.'},400);
 if(students.length>90)return out({error:'This classroom exceeds the batch size of 90. Create individual fee requests or contact head office.'},400);
 const writes=students.map(child=>env.DB.prepare('INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'invoices','FS_'+fee.id+'_'+child.id,JSON.stringify({student_id:child.id,title:fee.title,due_date:fee.due_date,amount_paise:fee.amount_paise,fee_structure_id:fee.id})));
 const result=await env.DB.batch([...writes,portalAudit(env,school,admin,'apply-fees',id)]);
 return out({success:true,created:result.slice(0,students.length).reduce((n,r)=>n+Number(r.meta?.changes??r.changes??0),0),students:students.length});
}

/* ==============================
   HEAD OFFICE SUPPLY CHAIN CRM
   Separate central workspace. Center inventory remains school-owned.
================================ */
const SUPPLY_KINDS=new Set(['vendors','products','vendor_pos','warehouse_receipts','packs','shipments','vendor_payables','vendor_payments','center_receivables','center_payments']);
const SUPPLY_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS neo_supply_records (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(kind,id))`,
 `CREATE INDEX IF NOT EXISTS neo_supply_kind_created ON neo_supply_records(kind,created_at DESC)`
];
const supplySchemaReady=new WeakMap();
async function ensureSupplySchema(env){if(!supplySchemaReady.has(env.DB)){const p=env.DB.batch(SUPPLY_SCHEMA.map(x=>env.DB.prepare(x))).catch(e=>{supplySchemaReady.delete(env.DB);throw e});supplySchemaReady.set(env.DB,p)}await supplySchemaReady.get(env.DB)}
async function supplyRows(env,kind){const r=await env.DB.prepare('SELECT id,data,created_at,updated_at FROM neo_supply_records WHERE kind=? ORDER BY created_at DESC,id').bind(kind).all();return (r.results||[]).map(x=>({...JSON.parse(x.data),id:x.id,created_at:x.created_at,updated_at:x.updated_at}))}
async function supplyOne(env,kind,id){const x=await env.DB.prepare('SELECT id,data,created_at,updated_at FROM neo_supply_records WHERE kind=? AND id=?').bind(kind,id).first();return x?{...JSON.parse(x.data),id:x.id,created_at:x.created_at,updated_at:x.updated_at}:null}
function supplyId(prefix){return prefix+'-'+neoToday().replaceAll('-','')+'-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}
function centerReceivable(order){const due=new Date((order.order_date||neoToday())+'T00:00:00Z');due.setUTCDate(due.getUTCDate()+(order.payment_terms==='Credit purchase'?Number(order.credit_days||0):0));return {receivable_no:'CR-'+order.po_no,school_id:order.school_id,school_name:order.school_name,center_order_id:order.id,order_no:order.po_no||order.id,item_name:order.item_name,payment_terms:order.payment_terms,payment_mode:order.payment_mode||'',amount_paise:Number(order.total_paise||0),paid_paise:0,outstanding_paise:Number(order.total_paise||0),due_date:due.toISOString().slice(0,10),status:'Outstanding'}}
async function supplyChain(request,env,url){
 if(!url.pathname.startsWith('/api/supply/'))return null;
 const out=(b,s=200)=>json(b,s,request);
 try{
  if(!await requireAdmin(request,env))return out({error:'Head Office login required.'},401);
  await ensurePortalSchema(env);await ensureSupplySchema(env);
  if(url.pathname==='/api/supply/setup'&&request.method==='POST')return out({success:true});
  if(url.pathname==='/api/supply/dashboard'&&request.method==='GET'){
   const schoolRows=(await env.DB.prepare("SELECT p.school_id,p.id,p.data,p.created_at,s.name school_name,s.city FROM neo_portal_records p JOIN neo_schools s ON s.school_id=p.school_id WHERE p.kind='purchase_orders' ORDER BY p.created_at DESC").all()).results||[];
   const center_orders=schoolRows.map(x=>({...JSON.parse(x.data),id:x.id,school_id:x.school_id,school_name:x.school_name,city:x.city,created_at:x.created_at,record_type:'Center Supply Order'}));
   const financeOrders=center_orders.filter(x=>['Approved','Dispatched','Delivered'].includes(x.status)&&Number(x.total_paise)>0);if(financeOrders.length)await env.DB.batch(financeOrders.map(x=>env.DB.prepare("INSERT OR IGNORE INTO neo_supply_records(kind,id,data) VALUES ('center_receivables',?,?)").bind('CREC-'+x.school_id+'-'+x.id,JSON.stringify(centerReceivable(x)))));
   const data={center_orders};for(const k of SUPPLY_KINDS)data[k]=await supplyRows(env,k);
   const receivedByProduct=new Map(),outByProduct=new Map();
   data.warehouse_receipts.forEach(x=>receivedByProduct.set(x.product_id,(receivedByProduct.get(x.product_id)||0)+Number(x.accepted_quantity||0)));
   data.packs.filter(x=>!['Cancelled'].includes(x.status)).forEach(x=>outByProduct.set(x.product_id,(outByProduct.get(x.product_id)||0)+Number(x.quantity||0)));
   data.central_stock=data.products.map(p=>({...p,on_hand:(receivedByProduct.get(p.id)||0)-(outByProduct.get(p.id)||0)}));
   return out(data);
  }
  const centerMatch=url.pathname.match(/^\/api\/supply\/center-orders\/([^/]+)\/([^/]+)$/);
  if(centerMatch&&request.method==='PATCH'){
   const school=decodeURIComponent(centerMatch[1]),id=decodeURIComponent(centerMatch[2]),old=await portalRecord(env,school,'purchase_orders',id);if(!old)return out({error:'Center Supply Order not found.'},404);
   const b=await request.json(),status=clean(b.status,40);if(!['Approved','Cancelled'].includes(status)||old.status!=='Submitted')return out({error:'Only a Submitted Center Supply Order can be approved or cancelled.'},409);
   const next={...old,status,office_note:clean(b.office_note,1000),approved_at:status==='Approved'?new Date().toISOString():''};delete next.id;
   const writes=[env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='purchase_orders' AND id=?").bind(JSON.stringify(next),school,id),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,'head-office','SUPPLY:'+status,id)];if(status==='Approved'&&Number(old.total_paise)>0){const schoolRow=await env.DB.prepare('SELECT name FROM neo_schools WHERE school_id=?').bind(school).first(),order={...old,id,school_id:school,school_name:schoolRow?.name||school};writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_supply_records(kind,id,data) VALUES ('center_receivables',?,?)").bind('CREC-'+school+'-'+id,JSON.stringify(centerReceivable(order))))}await env.DB.batch(writes);return out({success:true,id,status});
  }
  const m=url.pathname.match(/^\/api\/supply\/(vendors|products|vendor_pos|warehouse_receipts|packs|shipments|vendor_payables|vendor_payments|center_receivables|center_payments)(?:\/([^/]+))?$/);if(!m)return out({error:'Not found.'},404);
  const kind=m[1],id=m[2]?decodeURIComponent(m[2]):'';
  if(request.method==='GET')return out({records:await supplyRows(env,kind)});
  let b;try{b=await request.json()}catch{return out({error:'Valid JSON is required.'},400)}
  if(!b||typeof b!=='object'||Array.isArray(b))return out({error:'Invalid request.'},400);
  if(request.method==='PATCH'){
   if(!id)return out({error:'Record ID is required.'},400);const old=await supplyOne(env,kind,id);if(!old)return out({error:'Record not found.'},404);
   const allowed={vendor_pos:['Draft','Approved','Sent to Vendor','Vendor Confirmed','In Production','Dispatched','Partially Received','Received','Cancelled'],warehouse_receipts:['Received','Quality Checked','Rejected'],packs:['Waiting for Items','Ready for Packing','Packing','Packed','Quality Checked','Cancelled'],shipments:['Ready to Dispatch','Courier Booked','Dispatched','In Transit','Delivered','Exception','Cancelled'],vendors:['Active','Inactive'],products:['Active','Inactive'],vendor_payables:['Outstanding','Part paid','Paid'],center_receivables:['Outstanding','Part paid','Paid']}[kind];
   const status=clean(b.status,40);if(!allowed.includes(status))return out({error:'Invalid status update.'},400);
   const next={...old,status,updated_by:'head-office'};delete next.id;delete next.created_at;delete next.updated_at;
   await env.DB.prepare('UPDATE neo_supply_records SET data=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=?').bind(JSON.stringify(next),kind,id).run();return out({success:true,id,status});
  }
  if(request.method!=='POST')return out({error:'Method not allowed.'},405);
  const text=(k,max=160,required=true)=>{const v=clean(b[k],max);if(required&&!v)throw new Error(k+' is required.');return v},whole=(k,min=1,max=1000000)=>{const v=Number(b[k]);if(!Number.isInteger(v)||v<min||v>max)throw new Error('Check '+k+'.');return v};let data,recordId,extra=[];
  if(kind==='vendors'){recordId=supplyId('VEN');data={name:text('name'),vendor_type:text('vendor_type',80),contact_person:text('contact_person',120,false),mobile:text('mobile',20,false),email:text('email',160,false),gstin:text('gstin',24,false),address:text('address',500,false),credit_days:b.credit_days?whole('credit_days',0,365):0,lead_days:b.lead_days?whole('lead_days',0,365):0,status:'Active'};}
  else if(kind==='products'){recordId=supplyId(b.product_type==='Kit'?'KIT':'PRD');if(!['Component','Kit'].includes(b.product_type))throw new Error('Choose Component or Kit.');const centerPrice=Number(b.center_price_paise);if(!Number.isSafeInteger(centerPrice)||centerPrice<=0)throw new Error('Set a valid center selling price.');if(!['Student kits','Books','Uniforms','Stationery','Consumables','Other'].includes(b.center_category))throw new Error('Choose a valid center order category.');if(!['Playgroup','Nursery','LKG','UKG','Daycare','School-wide'].includes(b.program))throw new Error('Choose a valid programme.');let components=[];if(b.product_type==='Kit'){if(!Array.isArray(b.components)||!b.components.length||b.components.length>100)throw new Error('Add at least one item to the kit.');components=b.components.map((x,i)=>{const name=clean(x?.name,120),quantity=Number(x?.quantity),unitPrice=Number(x?.unit_price_paise);if(!name||!Number.isInteger(quantity)||quantity<1||quantity>1000||!Number.isSafeInteger(unitPrice)||unitPrice<=0)throw new Error('Check kit item '+(i+1)+'.');return {name,quantity,unit_price_paise:unitPrice,total_paise:quantity*unitPrice}});const componentTotal=components.reduce((n,x)=>n+x.total_paise,0);if(componentTotal!==centerPrice)throw new Error('Kit total must match the sum of its items.');}data={sku:text('sku',60),name:text('name'),product_type:b.product_type,category:text('category',80),center_category:b.center_category,program:b.program,size:text('size',80,false),unit:text('unit',30),reorder_level:b.reorder_level?whole('reorder_level',0,1000000):0,center_price_paise:centerPrice,available_to_centers:b.available_to_centers!==false,components,status:'Active'};}
  else if(kind==='vendor_pos'){recordId=supplyId('VPO');const vendor=await supplyOne(env,'vendors',text('vendor_id',80)),product=await supplyOne(env,'products',text('product_id',80));if(!vendor||vendor.status!=='Active'||!product||product.status!=='Active')throw new Error('Choose an active vendor and product.');const quantity=whole('quantity'),unit=Number(b.unit_price_paise);if(!Number.isSafeInteger(unit)||unit<=0)throw new Error('Check unit price.');data={po_no:recordId,vendor_id:vendor.id,vendor_name:vendor.name,product_id:product.id,product_name:product.name,quantity,received_quantity:0,unit_price_paise:unit,total_paise:quantity*unit,order_date:text('order_date',10),expected_date:text('expected_date',10),payment_terms:text('payment_terms',80),notes:text('notes',1000,false),status:'Draft'};}
  else if(kind==='warehouse_receipts'){recordId=supplyId('GRN');const po=await supplyOne(env,'vendor_pos',text('vendor_po_id',80));if(!po||['Draft','Cancelled','Received'].includes(po.status))throw new Error('Vendor PO must be approved/sent and open.');const received=whole('received_quantity'),damaged=b.damaged_quantity?whole('damaged_quantity',0,received):0,accepted=received-damaged;if(accepted<1)throw new Error('At least one accepted unit is required.');if(Number(po.received_quantity||0)+received>Number(po.quantity))throw new Error('Receipt exceeds Vendor PO balance.');data={grn_no:recordId,vendor_po_id:po.id,vendor_id:po.vendor_id,vendor_name:po.vendor_name,product_id:po.product_id,product_name:po.product_name,received_quantity:received,damaged_quantity:damaged,accepted_quantity:accepted,receipt_date:text('receipt_date',10),supplier_invoice:text('supplier_invoice',120),condition:text('condition',40),warehouse_location:text('warehouse_location',120),notes:text('notes',1000,false),status:'Received'};const totalReceived=Number(po.received_quantity||0)+received,next={...po,received_quantity:totalReceived,status:totalReceived>=Number(po.quantity)?'Received':'Partially Received'};delete next.id;delete next.created_at;delete next.updated_at;extra.push(env.DB.prepare('UPDATE neo_supply_records SET data=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=?').bind(JSON.stringify(next),'vendor_pos',po.id));const vendor=await supplyOne(env,'vendors',po.vendor_id),due=new Date(data.receipt_date+'T00:00:00Z');due.setUTCDate(due.getUTCDate()+Number(vendor?.credit_days||0));const payableId='PAY-'+recordId,payable={payable_no:payableId,vendor_id:po.vendor_id,vendor_name:po.vendor_name,vendor_po_id:po.id,grn_id:recordId,invoice_no:data.supplier_invoice,amount_paise:accepted*Number(po.unit_price_paise||0),paid_paise:0,outstanding_paise:accepted*Number(po.unit_price_paise||0),due_date:due.toISOString().slice(0,10),status:'Outstanding'};extra.push(env.DB.prepare("INSERT INTO neo_supply_records(kind,id,data) VALUES ('vendor_payables',?,?)").bind(payableId,JSON.stringify(payable)));}
  else if(kind==='packs'){recordId=supplyId('PACK');const product=await supplyOne(env,'products',text('product_id',80));if(!product)throw new Error('Product not found.');const quantity=whole('quantity'),received=(await supplyRows(env,'warehouse_receipts')).filter(x=>x.product_id===product.id&&!['Rejected'].includes(x.status)).reduce((n,x)=>n+Number(x.accepted_quantity||0),0),allocated=(await supplyRows(env,'packs')).filter(x=>x.product_id===product.id&&x.status!=='Cancelled').reduce((n,x)=>n+Number(x.quantity||0),0),available=received-allocated;if(quantity>available)throw new Error('Only '+available+' units are available in Head Office central stock.');data={pack_no:recordId,school_id:text('school_id',80),school_name:text('school_name'),center_order_id:text('center_order_id',80),product_id:product.id,product_name:product.name,quantity,box_count:whole('box_count'),weight_kg:Number(b.weight_kg||0),packed_by:text('packed_by',120),checked_by:text('checked_by',120,false),notes:text('notes',1000,false),status:'Packing'};}
  else if(kind==='shipments'){recordId=supplyId('SHIP');const pack=await supplyOne(env,'packs',text('pack_id',80));if(!pack||!['Packed','Quality Checked'].includes(pack.status))throw new Error('Pack must be completed before dispatch.');data={shipment_no:recordId,pack_id:pack.id,school_id:pack.school_id,school_name:pack.school_name,center_order_id:pack.center_order_id,courier_partner:text('courier_partner',120),awb_no:text('awb_no',120),box_count:pack.box_count,dispatch_date:text('dispatch_date',10),expected_delivery:text('expected_delivery',10),freight_paise:Number(b.freight_paise||0),proof_url:text('proof_url',500,false),notes:text('notes',1000,false),status:'Dispatched'};}
  else if(kind==='vendor_payments'){recordId=supplyId('VPAY');const payable=await supplyOne(env,'vendor_payables',text('payable_id',80)),amount=Number(b.amount_paise);if(!payable||payable.status==='Paid')throw new Error('Choose an outstanding payable.');if(!Number.isSafeInteger(amount)||amount<=0||amount>Number(payable.outstanding_paise))throw new Error('Payment cannot exceed payable outstanding.');data={payment_no:recordId,payable_id:payable.id,vendor_id:payable.vendor_id,vendor_name:payable.vendor_name,amount_paise:amount,payment_date:text('payment_date',10),payment_mode:text('payment_mode',40),reference:text('reference',120),notes:text('notes',1000,false),status:'Paid'};const paid=Number(payable.paid_paise||0)+amount,outstanding=Number(payable.amount_paise)-paid,next={...payable,paid_paise:paid,outstanding_paise:outstanding,status:outstanding?'Part paid':'Paid'};delete next.id;delete next.created_at;delete next.updated_at;extra.push(env.DB.prepare('UPDATE neo_supply_records SET data=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=?').bind(JSON.stringify(next),'vendor_payables',payable.id));}
  else if(kind==='center_payments'){recordId=supplyId('CPAY');const receivable=await supplyOne(env,'center_receivables',text('receivable_id',200)),amount=Number(b.amount_paise);if(!receivable||receivable.status==='Paid')throw new Error('Choose an outstanding center order.');if(!Number.isSafeInteger(amount)||amount<=0||amount>Number(receivable.outstanding_paise))throw new Error('Payment cannot exceed center outstanding.');data={payment_no:recordId,receivable_id:receivable.id,school_id:receivable.school_id,school_name:receivable.school_name,center_order_id:receivable.center_order_id,amount_paise:amount,payment_date:text('payment_date',10),payment_mode:text('payment_mode',40),reference:text('reference',120),notes:text('notes',1000,false),status:'Received'};const paid=Number(receivable.paid_paise||0)+amount,outstanding=Number(receivable.amount_paise)-paid,next={...receivable,paid_paise:paid,outstanding_paise:outstanding,status:outstanding?'Part paid':'Paid',last_payment_date:data.payment_date};delete next.id;delete next.created_at;delete next.updated_at;extra.push(env.DB.prepare('UPDATE neo_supply_records SET data=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=?').bind(JSON.stringify(next),'center_receivables',receivable.id));}
  else throw new Error('Direct finance record creation is not allowed.');
  await env.DB.batch([env.DB.prepare('INSERT INTO neo_supply_records(kind,id,data) VALUES (?,?,?)').bind(kind,recordId,JSON.stringify(data)),...extra]);return out({success:true,id:recordId,record:data},201);
 }catch(e){console.error('Supply chain error',e);return out({error:e?.message||'Supply chain request failed.'},400)}
}
function portalNotification(env,school,target,title,message,source_kind,source_id,status='Unread',link=''){
 const id='NTF_'+crypto.randomUUID().replace(/-/g,'').slice(0,20).toUpperCase();
 const data={target,title,message,source_kind,source_id,status,link,created_at:new Date().toISOString()};
 return env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'notifications',?,?)").bind(school,id,JSON.stringify(data));
}
function portalAudit(env,school,admin,action,id){return env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,admin?'head-office':'school:'+school,action,id)}
async function signParent(account,secret){const payload=base64urlEncode(JSON.stringify({role:'parent',account_id:account.account_id,version:account.password_hash,exp:Date.now()+8*3600000}));return payload+'.'+base64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC',await getSigningKey(secret),new TextEncoder().encode(payload))))}
async function parentSession(request,env){
 try{const parts=(request.headers.get('Authorization')||'').replace(/^Bearer /,'').split('.');if(parts.length!==2)return null;
 if(!await crypto.subtle.verify('HMAC',await getSigningKey(env.ADMIN_PASSWORD),base64urlDecode(parts[1]),new TextEncoder().encode(parts[0])))return null;
 const p=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));if(p.role!=='parent'||p.exp<=Date.now())return null;
 const a=await env.DB.prepare('SELECT a.* FROM neo_parent_accounts a JOIN neo_schools s ON s.school_id=a.school_id WHERE a.account_id=? AND a.active=1 AND s.active=1').bind(p.account_id).first();return a&&a.password_hash===p.version?a:null;
 }catch{return null}
}
async function parentPortal(request,env,url){
 if(!url.pathname.startsWith('/api/parent/'))return null;
 const out=(b,status=200)=>json(b,status,request);
 try{
 if(url.pathname==='/api/parent/login'&&request.method==='POST'){
  let b;try{b=await request.json()}catch{return out({error:'Invalid JSON.'},400)}
  const id=typeof b?.account_id==='string'?b.account_id.trim().toUpperCase():'';
  if(!/^NP-[A-Z0-9-]{8,32}$/.test(id)||typeof b.password!=='string'||b.password.length>128)return out({error:'Check your parent ID and password.'},400);
  const now=Date.now();const counter=await env.DB.prepare('INSERT INTO neo_login_attempts(school_id,attempts,expires) VALUES (?,1,?) ON CONFLICT(school_id) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END,expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts').bind('PARENT:'+id,now+900000,now,now,now+900000).first();
  if(counter.attempts>10)return out({error:'Too many attempts. Try again after 15 minutes.'},429);
  const a=await env.DB.prepare('SELECT a.* FROM neo_parent_accounts a JOIN neo_schools s ON s.school_id=a.school_id WHERE a.account_id=? AND a.active=1 AND s.active=1').bind(id).first();
  const hash=await schoolPassword(b.password,a?.salt||'invalid-parent');if(!a||hash!==a.password_hash)return out({error:'Check your parent ID and password.'},401);
  return out({token:await signParent(a,env.ADMIN_PASSWORD)});
 }
 const a=await parentSession(request,env);if(!a)return out({error:'Parent sign in required.'},401);
 if(url.pathname==='/api/parent/password'&&request.method==='POST'){
  const b=await request.json();if(typeof b.current_password!=='string'||b.current_password.length>128||!strongPortalPassword(b.password))return out({error:'Enter current password and a new password of 8â€“128 characters with uppercase, lowercase, number and symbol.'},400);
  if(await schoolPassword(b.current_password,a.salt)!==a.password_hash)return out({error:'Current password is incorrect.'},403);
  const salt=crypto.randomUUID(),hash=await schoolPassword(b.password,salt);await env.DB.batch([env.DB.prepare('UPDATE neo_parent_accounts SET password_hash=?,salt=? WHERE account_id=?').bind(hash,salt,a.account_id),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'parent:'+a.account_id,'password-change',a.student_id)]);return out({success:true});
 }
 if(url.pathname!=='/api/parent/me'||request.method!=='GET')return out({error:'Not found.'},404);
 const child=await portalRecord(env,a.school_id,'students',a.student_id);if(!child)return out({error:'Student record not available. Contact your school.'},404);
 const school=await env.DB.prepare('SELECT name,city FROM neo_schools WHERE school_id=?').bind(a.school_id).first();
 const kinds=['attendance','invoices','payments','homework','announcements','stock_moves','orders'];
 const pairs=await Promise.all(kinds.map(async k=>{
  // Only fetch this child's rows or explicitly published classroom/school content.
  const sql=k==='homework'?"json_extract(data,'$.published')=1 AND json_extract(data,'$.classroom_id')=?":k==='announcements'?"COALESCE(json_extract(data,'$.audience'),'Parents and teachers')!='Teachers only' AND json_extract(data,'$.published')=1 AND (json_extract(data,'$.classroom_id')='' OR json_extract(data,'$.classroom_id')=?)":"json_extract(data,'$.student_id')=?";
  const arg=['homework','announcements'].includes(k)?(child.classroom_id||'UNASSIGNED'):a.student_id;
  const rows=await env.DB.prepare('SELECT id,data,created_at FROM neo_portal_records WHERE school_id=? AND kind=? AND '+sql+' ORDER BY created_at DESC,id').bind(a.school_id,k,arg).all();return [k,(rows.results||[]).map(r=>({...JSON.parse(r.data),id:r.id,created_at:r.created_at}))];
 }));
 return out({school,child:{name:child.name,program:child.program,academic_year:child.academic_year},...Object.fromEntries(pairs)});
 }catch(e){console.error('Parent portal error',e);return out({error:'Parent portal unavailable. Please contact your school.'},503)}
}

async function employeeToken(a,secret){const payload=base64urlEncode(JSON.stringify({role:'employee',account_id:a.account_id,version:a.password_hash,exp:Date.now()+8*3600000}));return payload+'.'+base64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC',await getSigningKey(secret),new TextEncoder().encode(payload))))}
async function employeeSession(request,env){try{const parts=(request.headers.get('Authorization')||'').replace(/^Bearer /,'').split('.');if(parts.length!==2)return null;if(!await crypto.subtle.verify('HMAC',await getSigningKey(env.ADMIN_PASSWORD),base64urlDecode(parts[1]),new TextEncoder().encode(parts[0])))return null;const p=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));if(p.role!=='employee'||p.exp<=Date.now())return null;const a=await env.DB.prepare('SELECT e.* FROM neo_employee_accounts e JOIN neo_schools s ON s.school_id=e.school_id WHERE e.account_id=? AND e.active=1 AND s.active=1').bind(p.account_id).first();return a&&a.password_hash===p.version?a:null}catch{return null}}
async function employeePortal(request,env,url){
 if(!url.pathname.startsWith('/api/employee/'))return null;const out=(b,status=200)=>json(b,status,request);try{await ensurePortalSchema(env);
 if(url.pathname==='/api/employee/login'&&request.method==='POST'){const b=await request.json(),id=typeof b?.account_id==='string'?b.account_id.trim().toUpperCase():'';if(!/^NT-[A-Z0-9-]{8,32}$/.test(id)||typeof b.password!=='string'||b.password.length>128)return out({error:'Check Employee ID and password.'},400);const a=await env.DB.prepare('SELECT e.* FROM neo_employee_accounts e JOIN neo_schools s ON s.school_id=e.school_id WHERE e.account_id=? AND e.active=1 AND s.active=1').bind(id).first();const hash=await schoolPassword(b.password,a?.salt||'invalid-employee');if(!a||hash!==a.password_hash)return out({error:'Check Employee ID and password.'},401);return out({token:await employeeToken(a,env.ADMIN_PASSWORD)})}
 const a=await employeeSession(request,env);if(!a)return out({error:'Employee sign in required.'},401);const staff=await portalRecord(env,a.school_id,'staff',a.staff_id);if(!staff||staff.status==='Inactive')return out({error:'Staff profile is unavailable.'},403);const school=await env.DB.prepare('SELECT name,city FROM neo_schools WHERE school_id=?').bind(a.school_id).first();const pick=async k=>(await portalRows(env,a.school_id,k)).filter(x=>x.staff_id===a.staff_id);
 if(url.pathname==='/api/employee/me'&&request.method==='GET'){const notifications=(await portalRows(env,a.school_id,'notifications')).filter(n=>n.target==='staff:'+a.staff_id);return out({account_id:a.account_id,name:a.name,school_id:a.school_id,staff_id:a.staff_id,staff_type:a.staff_type,staff,school,leaves:await pick('staff_leave'),advances:await pick('salary_advances'),payroll:await pick('payroll'),attendance:await pick('staff_attendance'),notifications});}
 if(url.pathname==='/api/employee/hr/leave'&&request.method==='POST'){const b=await request.json(),valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));if(!valid(b.from_date)||!valid(b.to_date)||b.to_date<b.from_date||!['Casual','Sick','Earned','Unpaid','Other'].includes(b.leave_type)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)return out({error:'Check leave dates, type and reason.'},400);const id=typeof b.request_id==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(b.request_id)?b.request_id:crypto.randomUUID(),data={staff_id:a.staff_id,leave_type:b.leave_type,from_date:b.from_date,to_date:b.to_date,reason:b.reason.trim(),status:'Pending',requested_by:'employee:'+a.account_id};await env.DB.batch([env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'staff_leave',?,?)").bind(a.school_id,id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'employee:'+a.account_id,'POST:staff_leave',id),portalNotification(env,a.school_id,'hr','New leave request',a.name+' submitted a leave request.','staff_leave',id,'Unread','hr_workflow')]);return out({success:true,id,status:'Pending'},201)}
 if(url.pathname==='/api/employee/hr/advance'&&request.method==='POST'){const b=await request.json(),amount=Number(b.amount_paise),installments=Number(b.installments||1);if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000||!Number.isInteger(installments)||installments<1||installments>24||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(b.recovery_month||''))||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)return out({error:'Check advance amount, recovery plan and reason.'},400);const id=typeof b.request_id==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(b.request_id)?b.request_id:crypto.randomUUID(),data={staff_id:a.staff_id,amount_paise:amount,request_date:neoToday(),reason:b.reason.trim(),recovery_month:b.recovery_month,installments,status:'Pending',requested_by:'employee:'+a.account_id};await env.DB.batch([env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'salary_advances',?,?)").bind(a.school_id,id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'employee:'+a.account_id,'POST:salary_advances',id),portalNotification(env,a.school_id,'hr','New salary advance request',a.name+' submitted a salary advance request.','salary_advances',id,'Unread','hr_workflow')]);return out({success:true,id,status:'Pending'},201)}
 if(url.pathname==='/api/employee/password'&&request.method==='POST'){const b=await request.json();if(typeof b.current_password!=='string'||b.current_password.length>128||!strongPortalPassword(b.password))return out({error:'Enter current password and a strong new password.'},400);if(await schoolPassword(b.current_password,a.salt)!==a.password_hash)return out({error:'Current password is incorrect.'},403);const salt=crypto.randomUUID(),hash=await schoolPassword(b.password,salt);await env.DB.batch([env.DB.prepare('UPDATE neo_employee_accounts SET password_hash=?,salt=? WHERE account_id=?').bind(hash,salt,a.account_id),env.DB.prepare('UPDATE neo_teacher_accounts SET password_hash=?,salt=? WHERE account_id=?').bind(hash,salt,a.account_id),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'employee:'+a.account_id,'password-change',a.account_id)]);return out({success:true})}
 return out({error:'Not found.'},404)}catch(e){console.error('employee portal',e);return out({error:'Employee portal temporarily unavailable.'},503)}}

async function teacherToken(a,secret){const payload=base64urlEncode(JSON.stringify({role:'teacher',account_id:a.account_id,version:a.password_hash,exp:Date.now()+8*3600000}));return payload+'.'+base64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC',await getSigningKey(secret),new TextEncoder().encode(payload))))}
async function teacherSession(request,env){try{
 const parts=(request.headers.get('Authorization')||'').replace(/^Bearer /,'').split('.');if(parts.length!==2)return null;
 if(!await crypto.subtle.verify('HMAC',await getSigningKey(env.ADMIN_PASSWORD),base64urlDecode(parts[1]),new TextEncoder().encode(parts[0])))return null;
 const p=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));if(p.role!=='teacher'||p.exp<=Date.now())return null;
 const a=await env.DB.prepare('SELECT a.* FROM neo_teacher_accounts a JOIN neo_schools s ON s.school_id=a.school_id WHERE a.account_id=? AND a.active=1 AND s.active=1').bind(p.account_id).first();return a&&a.password_hash===p.version?{...a,classroom_ids:JSON.parse(a.classroom_ids)}:null;
 }catch{return null}}
async function teacherPortal(request,env,url){
 if(!url.pathname.startsWith('/api/teacher/'))return null;
 const out=(b,status=200)=>json(b,status,request);
 try{
 if(url.pathname==='/api/teacher/login'&&request.method==='POST'){
  const b=await request.json(),id=typeof b?.account_id==='string'?b.account_id.trim().toUpperCase():'';
  if(!/^NT-[A-Z0-9-]{8,32}$/.test(id)||typeof b.password!=='string'||b.password.length>128)return out({error:'Check teacher ID and password.'},400);
  const now=Date.now(),counter=await env.DB.prepare('INSERT INTO neo_login_attempts(school_id,attempts,expires) VALUES (?,1,?) ON CONFLICT(school_id) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END,expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts').bind('TEACHER:'+id,now+900000,now,now,now+900000).first();
  if(counter.attempts>10)return out({error:'Too many attempts. Try again after 15 minutes.'},429);
  const a=await env.DB.prepare('SELECT a.* FROM neo_teacher_accounts a JOIN neo_schools s ON s.school_id=a.school_id WHERE a.account_id=? AND a.active=1 AND s.active=1').bind(id).first();
  const hash=await schoolPassword(b.password,a?.salt||'invalid-teacher');if(!a||hash!==a.password_hash)return out({error:'Check teacher ID and password.'},401);
  return out({token:await teacherToken(a,env.ADMIN_PASSWORD)});
 }
 const a=await teacherSession(request,env);if(!a)return out({error:'Teacher sign in required.'},401);
 const students=(await portalRows(env,a.school_id,'students')).filter(s=>a.classroom_ids.includes(s.classroom_id));
 if(url.pathname==='/api/teacher/me'&&request.method==='GET'){
  const school=await env.DB.prepare('SELECT name,city FROM neo_schools WHERE school_id=?').bind(a.school_id).first();
  const classrooms=(await portalRows(env,a.school_id,'classrooms')).filter(c=>a.classroom_ids.includes(c.id));
  const attendance=(await portalRows(env,a.school_id,'attendance')).filter(r=>students.some(s=>s.id===r.student_id));
  const homework=(await portalRows(env,a.school_id,'homework')).filter(r=>a.classroom_ids.includes(r.classroom_id));
  const announcements=(await portalRows(env,a.school_id,'announcements')).filter(n=>n.published&&(!n.classroom_id||a.classroom_ids.includes(n.classroom_id)));
  const tasks=(await portalRows(env,a.school_id,'teacher_tasks')).filter(t=>t.teacher_id===a.account_id);
  return out({tasks,announcements,name:a.name,school,classrooms,students:students.map(s=>({id:s.id,name:s.name,dob:s.dob,program:s.program,classroom_id:s.classroom_id})),attendance,homework});
 }
 if(url.pathname==='/api/teacher/hr'&&request.method==='GET'){
  const link=await env.DB.prepare('SELECT staff_id FROM neo_teacher_staff_links WHERE school_id=? AND account_id=?').bind(a.school_id,a.account_id).first();if(!link)return out({error:'Teacher login is not linked to Staff Master. Contact HR.'},409);
  const pick=async k=>(await portalRows(env,a.school_id,k)).filter(x=>x.staff_id===link.staff_id),notifications=(await portalRows(env,a.school_id,'notifications')).filter(n=>n.target==='staff:'+link.staff_id);return out({staff:await portalRecord(env,a.school_id,'staff',link.staff_id),leaves:await pick('staff_leave'),advances:await pick('salary_advances'),payroll:await pick('payroll'),attendance:await pick('staff_attendance'),notifications});
 }
 if(url.pathname==='/api/teacher/hr/leave'&&request.method==='POST'){
  const link=await env.DB.prepare('SELECT staff_id FROM neo_teacher_staff_links WHERE school_id=? AND account_id=?').bind(a.school_id,a.account_id).first();if(!link)return out({error:'Teacher login is not linked to Staff Master. Contact HR.'},409);const b=await request.json(),valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
  if(!valid(b.from_date)||!valid(b.to_date)||b.to_date<b.from_date||!['Casual','Sick','Earned','Unpaid','Other'].includes(b.leave_type)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)return out({error:'Check leave dates, type and reason.'},400);const id=typeof b.request_id==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(b.request_id)?b.request_id:crypto.randomUUID(),data={staff_id:link.staff_id,leave_type:b.leave_type,from_date:b.from_date,to_date:b.to_date,reason:b.reason.trim(),status:'Pending',requested_by:'teacher:'+a.account_id};await env.DB.batch([env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'staff_leave',?,?)").bind(a.school_id,id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'teacher:'+a.account_id,'POST:staff_leave',id),portalNotification(env,a.school_id,'hr','New leave request',a.name+' submitted a leave request.','staff_leave',id,'Unread','hr_workflow')]);return out({success:true,id,status:'Pending'},201);
 }
 if(url.pathname==='/api/teacher/hr/advance'&&request.method==='POST'){
  const link=await env.DB.prepare('SELECT staff_id FROM neo_teacher_staff_links WHERE school_id=? AND account_id=?').bind(a.school_id,a.account_id).first();if(!link)return out({error:'Teacher login is not linked to Staff Master. Contact HR.'},409);const b=await request.json(),amount=Number(b.amount_paise),installments=Number(b.installments||1);if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000||!Number.isInteger(installments)||installments<1||installments>24||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(b.recovery_month||''))||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)return out({error:'Check advance amount, recovery plan and reason.'},400);const id=typeof b.request_id==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(b.request_id)?b.request_id:crypto.randomUUID(),data={staff_id:link.staff_id,amount_paise:amount,request_date:neoToday(),reason:b.reason.trim(),recovery_month:b.recovery_month,installments,status:'Pending',requested_by:'teacher:'+a.account_id};await env.DB.batch([env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'salary_advances',?,?)").bind(a.school_id,id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'teacher:'+a.account_id,'POST:salary_advances',id),portalNotification(env,a.school_id,'hr','New salary advance request',a.name+' submitted a salary advance request.','salary_advances',id,'Unread','hr_workflow')]);return out({success:true,id,status:'Pending'},201);
 }
 if(url.pathname==='/api/teacher/password'&&request.method==='POST'){
  const b=await request.json();if(typeof b.current_password!=='string'||b.current_password.length>128||!strongPortalPassword(b.password))return out({error:'Enter current password and a new password of 8â€“128 characters with uppercase, lowercase, number and symbol.'},400);
  if(await schoolPassword(b.current_password,a.salt)!==a.password_hash)return out({error:'Current password is incorrect.'},403);
  const salt=crypto.randomUUID();await env.DB.batch([env.DB.prepare('UPDATE neo_teacher_accounts SET password_hash=?,salt=? WHERE account_id=?').bind(await schoolPassword(b.password,salt),salt,a.account_id),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'teacher:'+a.account_id,'password-change',a.account_id)]);return out({success:true});
 }
 if(url.pathname==='/api/teacher/tasks'&&request.method==='POST'){
  const b=await request.json();if(!b||!['Completed','Not completed'].includes(b.status)||typeof b.comment!=='string'||!b.comment.trim()||b.comment.length>1000)return out({error:'Choose an outcome and provide a completion note or reason.'},400);
  const task=await portalRecord(env,a.school_id,'teacher_tasks',b.id);if(!task||task.teacher_id!==a.account_id)return out({error:'Task not assigned to you.'},403);
  if(b.revision!==task.revision)return out({error:'Task changed. Refresh before saving.'},409);
  const data={...task,status:b.status,revision:task.revision+1,history:[...task.history,{date:neoToday(),status:b.status,comment:b.comment.trim(),teacher_name:a.name}]};delete data.id;delete data.created_at;
  const result=await env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='teacher_tasks' AND id=? AND json_extract(data,'$.revision')=?").bind(JSON.stringify(data),a.school_id,b.id,task.revision).run();
  if(Number(result.meta?.changes??result.changes??0)!==1)return out({error:'Task changed. Refresh before saving.'},409);
  return out({success:true});
 }
 const kind=url.pathname==='/api/teacher/attendance'?'attendance':url.pathname==='/api/teacher/homework'?'homework':null;
 if(!kind||request.method!=='POST')return out({error:'Not found.'},404);
 const raw=await request.text();if(raw.length>8000)return out({error:'Request too large.'},413);let b;try{b=JSON.parse(raw)}catch{return out({error:'Invalid JSON.'},400)}
 if(!b||typeof b!=='object')return out({error:'Invalid record.'},400);
 let id=typeof b.request_id==='string'?b.request_id:'',data;
 if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))return out({error:'Invalid request ID.'},400);
 const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(kind==='attendance'){
  if(!students.some(s=>s.id===b.student_id))return out({error:'Student is not in your assigned classrooms.'},403);
  if(!validDate(b.date)||b.date>new Date(Date.now()+330*60000).toISOString().slice(0,10)||!['Present','Absent','Leave'].includes(b.status))return out({error:'Check attendance date and status.'},400);
  id=b.student_id+'_'+b.date;data={student_id:b.student_id,date:b.date,status:b.status};
 }else{
  if(!a.classroom_ids.includes(b.classroom_id))return out({error:'Classroom not assigned to you.'},403);
  if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200||typeof b.instructions!=='string'||!b.instructions.trim()||b.instructions.length>2000||!validDate(b.due_date))return out({error:'Enter title, instructions and a valid due date.'},400);
  if(await portalRecord(env,a.school_id,'homework',id))return out({error:'This homework was already submitted. Refresh the list.'},409);
  for(const key of ['subject','topic','homework_type'])if(b[key]!==undefined&&(typeof b[key]!=='string'||b[key].length>200))return out({error:'Invalid homework details.'},400);
  data={subject:b.subject||'',topic:b.topic||'',homework_type:b.homework_type||'',classroom_id:b.classroom_id,title:b.title.trim(),instructions:b.instructions.trim(),due_date:b.due_date,published:b.published===true,teacher_name:a.name};
 }
 let sql='INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)';if(kind==='attendance')sql+=' ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data';
 await env.DB.batch([env.DB.prepare(sql).bind(a.school_id,kind,id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),a.school_id,'teacher:'+a.account_id,'POST:'+kind,id)]);
 return out({success:true,id},201);
 }catch(e){console.error('Teacher portal error',e);return out({error:'Teacher portal unavailable. Contact your school.'},503)}
}

const neoToday=()=>new Date(Date.now()+330*60000).toISOString().slice(0,10);
function learningDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v}
function validateLearningPlan(b){
 const fail=m=>{throw new TypeError(m)};
 if(!b||typeof b!=='object')fail('Upload a curriculum object.');
 if(typeof b.title!=='string'||!b.title.trim()||b.title.length>160)fail('Enter a curriculum title.');
 if(!Array.isArray(b.working_dates)||b.working_dates.length!==200||!b.working_dates.every(learningDate)||b.working_dates.some((d,i)=>i>0&&d<=b.working_dates[i-1]))fail('Provide exactly 200 unique working dates in chronological order.');
 if(Date.parse(b.working_dates[199])-Date.parse(b.working_dates[0])>730*86400000)fail('Calendar must fit within two years.');
 if(!Array.isArray(b.lessons)||b.lessons.length<1||b.lessons.length>1200)fail('Provide 1â€“1200 concepts. Drafts may be incomplete; approval requires all 200 days.');
 const ids=new Set();
 const lessons=b.lessons.map((l,i)=>{
  if(!Number.isInteger(l.day)||l.day<1||l.day>200)fail('Concept '+(i+1)+': day must be 1â€“200.');
  const item={day:l.day,id:typeof l.id==='string'?l.id:'lesson-'+(i+1)};
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(item.id)||ids.has(item.id))fail('Concept IDs must be unique.');ids.add(item.id);
  for(const [k,max] of [['subject',80],['concept',180],['objective',500],['activity',1000]]){if(typeof l[k]!=='string'||!l[k].trim()||l[k].length>max)fail('Concept '+(i+1)+': check '+k);item[k]=l[k].trim()}
  if(!Array.isArray(l.questions)||l.questions.length<1||l.questions.length>5||l.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>300))fail('Each concept needs 1â€“5 approved parent conversation questions.');
  if(l.materials!==undefined&&(typeof l.materials!=='string'||l.materials.length>1000))fail('Check preparation materials.');item.materials=l.materials||'';for(const [key,max] of [['homework',1500],['period',50],['start',5],['end',5]]){if(l[key]!==undefined&&(typeof l[key]!=='string'||l[key].length>max))fail('Check '+key);item[key]=l[key]||'';}if((item.start||item.end)&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end)||item.start>=item.end))fail('Check period start/end times.');item.questions=l.questions.map(q=>q.trim());return item;
 });
 for(let i=0;i<lessons.length;i++)for(let j=i+1;j<lessons.length;j++){const a=lessons[i],c=lessons[j];if(a.day===c.day&&a.start&&c.start&&a.start<c.end&&c.start<a.end)fail('Periods overlap on Day '+a.day);}
 return {
  title:b.title.trim(),
  working_dates:b.working_dates,
  lessons,
  master_curriculum_id:typeof b.master_curriculum_id==='string'?b.master_curriculum_id:'',
  master_level:typeof b.master_level==='string'?b.master_level:'',
  master_version:typeof b.master_version==='string'?b.master_version:'',
  master_status:typeof b.master_status==='string'?b.master_status:''
};
}
function validateMasterCurriculum(b){
 const fail=m=>{throw new TypeError(m)};
 if(!b||typeof b!=='object')fail('Upload a master curriculum object.');

 const levels=['Playgroup','Nursery','LKG','UKG','Daycare'];
 if(typeof b.level!=='string'||!levels.includes(b.level.trim()))
  fail('Choose a valid curriculum level.');

 if(typeof b.version!=='string'||!b.version.trim()||b.version.trim().length>40)
  fail('Enter a curriculum version.');

 if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>160)
  fail('Enter a curriculum title.');

 if(!Array.isArray(b.lessons)||b.lessons.length<1||b.lessons.length>1200)
  fail('Provide 1â€“1200 concepts.');

 const ids=new Set();

 const lessons=b.lessons.map((l,i)=>{
  if(!Number.isInteger(l.day)||l.day<1||l.day>200)
   fail('Concept '+(i+1)+': day must be 1â€“200.');

  const item={
   day:l.day,
   id:typeof l.id==='string'?l.id:'lesson-'+(i+1)
  };

  if(!/^[A-Za-z0-9_-]{1,64}$/.test(item.id)||ids.has(item.id))
   fail('Concept IDs must be unique.');
  ids.add(item.id);

  for(const [k,max] of [
   ['subject',80],
   ['concept',180],
   ['objective',500],
   ['activity',1000]
  ]){
   if(typeof l[k]!=='string'||!l[k].trim()||l[k].length>max)
    fail('Concept '+(i+1)+': check '+k);
   item[k]=l[k].trim();
  }

  if(!Array.isArray(l.questions)||l.questions.length<1||l.questions.length>5||
     l.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>300))
   fail('Each concept needs 1â€“5 approved parent conversation questions.');

  item.questions=l.questions.map(q=>q.trim());

  if(l.materials!==undefined&&(typeof l.materials!=='string'||l.materials.length>1000))
   fail('Check preparation materials.');

  item.materials=l.materials||'';

  for(const [key,max] of [
   ['homework',1500],
   ['period',50],
   ['start',5],
   ['end',5]
  ]){
   if(l[key]!==undefined&&(typeof l[key]!=='string'||l[key].length>max))
    fail('Check '+key);
   item[key]=l[key]||'';
  }

  if((item.start||item.end)&&
     (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start)||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end)||
      item.start>=item.end))
   fail('Check period start/end times.');

  return item;
 });

 return {
  level:b.level.trim(),
  version:b.version.trim(),
  title:b.title.trim(),
  lessons
 };
}

async function learningPortal(request,env,url){
 if(!url.pathname.startsWith('/api/learning/'))return null;
 const out=(b,status=200)=>json(b,status,request);
 try{
 const admin=await requireAdmin(request,env),schoolSessionValue=admin?null:await schoolSession(request,env);
 const teacher=admin||schoolSessionValue?null:await teacherSession(request,env);
 const parent=admin||schoolSessionValue||teacher?null:await parentSession(request,env);
 if(!admin&&!schoolSessionValue&&!teacher&&!parent)return out({error:'Sign in required.'},401);
 await ensurePortalSchema(env);
// Head Office Master Curriculum API
if(url.pathname==='/api/learning/master-curricula'&&request.method==='GET'){
 if(!admin&&!schoolSessionValue)
  return out({error:'Head-office or school access required.'},403);

 const level=url.searchParams.get('level');
 const sql=admin
  ? (level
      ? 'SELECT * FROM neo_master_curricula WHERE level=? ORDER BY created_at DESC'
      : 'SELECT * FROM neo_master_curricula ORDER BY level,created_at DESC')
  : (level
      ? "SELECT * FROM neo_master_curricula WHERE status IN ('Published','TestPublished') AND level=? ORDER BY created_at DESC"
      : "SELECT * FROM neo_master_curricula WHERE status IN ('Published','TestPublished') ORDER BY level,created_at DESC");

 const result=level
  ? await env.DB.prepare(sql).bind(level).all()
  : await env.DB.prepare(sql).all();

 const curricula=(result.results||[]).map(r=>({
  id:r.id,
  level:r.level,
  version:r.version,
  status:r.status,
  published_at:r.published_at,
  created_at:r.created_at,
  ...JSON.parse(r.data)
 }));

 return out({curricula});
}

if(url.pathname==='/api/learning/master-curricula'&&request.method==='POST'){
 if(!admin)return out({error:'Head-office access required.'},403);

 const raw=await request.text();
 if(raw.length>1500000)
  return out({error:'Master curriculum file is too large.'},413);

 let b;
 try{b=JSON.parse(raw)}
 catch{return out({error:'Invalid JSON.'},400)}

 const data=validateMasterCurriculum(b);
 const id=b.id||crypto.randomUUID();

 if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))
  return out({error:'Invalid curriculum ID.'},400);

 const old=await env.DB.prepare(
  'SELECT id,status FROM neo_master_curricula WHERE id=?'
 ).bind(id).first();

 if(old&&old.status!=='Draft')
  return out({error:'Published master curriculum is locked.'},409);

 try{
  if(old){
   await env.DB.prepare(
    "UPDATE neo_master_curricula SET level=?,version=?,data=? WHERE id=? AND status='Draft'"
   ).bind(data.level,data.version,JSON.stringify(data),id).run();
  }else{
   await env.DB.prepare(
    "INSERT INTO neo_master_curricula(id,level,version,status,data) VALUES (?,?,?,'Draft',?)"
   ).bind(id,data.level,data.version,JSON.stringify(data)).run();
  }
 }catch(e){
  if(String(e.message).includes('UNIQUE'))
   return out({error:'This level and version already exists.'},409);
  throw e;
 }

 return out({
  success:true,
  id,
  status:'Draft',
  days_covered:new Set(data.lessons.map(l=>l.day)).size
 },201);
}

if(url.pathname==='/api/learning/master-curricula/publish'&&request.method==='POST'){
 if(!admin)return out({error:'Head-office access required.'},403);

 const raw=await request.text();
 let b;
 try{b=JSON.parse(raw)}
 catch{return out({error:'Invalid JSON.'},400)}

 if(!b||typeof b.id!=='string')
  return out({error:'Choose a master curriculum.'},400);

 const row=await env.DB.prepare(
  'SELECT * FROM neo_master_curricula WHERE id=?'
 ).bind(b.id).first();

 if(!row)return out({error:'Master curriculum not found.'},404);

 if(row.status==='Published'||row.status==='TestPublished')
  return out({success:true,status:row.status});

 const checked=validateMasterCurriculum(JSON.parse(row.data));
 const days=new Set(checked.lessons.map(l=>l.day)).size;

 // Explicit test mode keeps Day-1 testing possible.
 const testMode=b.test_mode===true;

 if(!testMode&&days!==200)
  return out({
   error:'Production publish requires curriculum concepts for all 200 days.'
  },400);

 const status=testMode?'TestPublished':'Published';

 const saved=await env.DB.prepare(
  "UPDATE neo_master_curricula SET status=?,published_at=CURRENT_TIMESTAMP WHERE id=? AND status='Draft'"
 ).bind(status,row.id).run();

 if(Number(saved.meta?.changes??saved.changes??0)!==1)
  return out({error:'Curriculum changed. Reload before publishing.'},409);

 return out({
  success:true,
  id:row.id,
  status,
  days_covered:days
 });
}

 const school=url.searchParams.get('school_id')||schoolSessionValue?.school_id||teacher?.school_id||parent?.school_id;
 if(!school||(!admin&&school!==(schoolSessionValue||teacher||parent).school_id))return out({error:'School access denied.'},403);
 if(!await env.DB.prepare('SELECT school_id FROM neo_schools WHERE school_id=?').bind(school).first())return out({error:'School not found.'},404);
 const deferred=await portalRows(env,school,'lesson_deferred');
 const plans=async()=>{const rows=await env.DB.prepare('SELECT * FROM neo_learning_plans WHERE school_id=? ORDER BY created_at DESC').bind(school).all();return rows.results.map(r=>({...JSON.parse(r.data),id:r.id,classroom_id:r.classroom_id,academic_year:r.academic_year,status:r.status}))};
 const completions=async()=>{const rows=await env.DB.prepare('SELECT data,plan_id,lesson_id,classroom_id,completed_at FROM neo_learning_completed WHERE school_id=? ORDER BY completed_at DESC').bind(school).all();return rows.results.map(r=>({...JSON.parse(r.data),plan_id:r.plan_id,lesson_id:r.lesson_id,classroom_id:r.classroom_id,completed_at:r.completed_at}))};
 const calendarResponse=await neoCalendar(request,env,url,{admin,teacher,parent,school});if(calendarResponse)return calendarResponse;
 const academicCalendarResponse=await neoAcademicCalendar(request,env,url,{admin,teacher,parent,school});if(academicCalendarResponse)return academicCalendarResponse;
 const ticketResponse=await neoTickets(request,env,url,{admin,schoolSessionValue,teacher,parent,school});if(ticketResponse)return ticketResponse;
 
 const periodExecutionResponse=await neoPeriodExecution(
  request,
  env,
  url,
  {admin,schoolSessionValue,teacher,parent,school}
);

if(periodExecutionResponse)return periodExecutionResponse;
const timetableResponse=await learningTimetable(request,env,url,{admin,schoolSessionValue,teacher,parent,school});if(timetableResponse)return timetableResponse;
 if(url.pathname==='/api/learning/feed'&&request.method==='GET'){
  let completed=await completions(),notes=[],completedChildClass=null;
  if(parent){const child=await portalRecord(env,school,'students',parent.student_id);if(!child)return out({error:'Student not found.'},404);
   completedChildClass=child.classroom_id;completed=completed.filter(r=>r.classroom_id===child.classroom_id);
   const rows=await env.DB.prepare('SELECT id,data FROM neo_learning_notes WHERE school_id=? AND student_id=? ORDER BY created_at DESC').bind(school,parent.student_id).all();notes=rows.results.map(r=>({...JSON.parse(r.data),id:r.id}));
   // A completed class concept is not a claim that every individual child attended or mastered it.
   const attendance=await portalRows(env,school,'attendance');completed=completed.map(r=>({...r,child_attendance:attendance.find(a=>a.student_id===parent.student_id&&a.date===r.completed_date)?.status||'Not recorded'}));
  }else{
   if(teacher)completed=completed.filter(r=>teacher.classroom_ids.includes(r.classroom_id));
   const children=await portalRows(env,school,'students');
   const rows=(await env.DB.prepare('SELECT id,student_id,data FROM neo_learning_notes WHERE school_id=? ORDER BY created_at DESC').bind(school).all()).results||[];
   notes=rows.filter(n=>!teacher||children.some(c=>c.id===n.student_id&&teacher.classroom_ids.includes(c.classroom_id))).map(n=>({...JSON.parse(n.data),id:n.id,student_id:n.student_id,child_name:children.find(c=>c.id===n.student_id)?.name||n.student_id}));
  }
  const scheduled_homework=parent?(await plans()).filter(p=>p.status==='Approved'&&p.classroom_id===completedChildClass).flatMap(p=>p.lessons.filter(l=>l.homework&&p.working_dates[l.day-1]<=neoToday()).map(l=>({id:p.id+':'+l.id,date:p.working_dates[l.day-1],subject:l.subject,topic:l.concept,instructions:l.homework}))):[];
  return out({scheduled_homework,today:neoToday(),activities:completed,comments:notes,deferred:parent?[]:teacher?deferred.filter(d=>teacher.classroom_ids.includes(d.classroom_id)):deferred});
 }
 if(parent)return out({error:'Parent access is read-only.'},403);
 if(url.pathname==='/api/learning/plans'&&request.method==='GET'){
  const all=await plans();return out({today:neoToday(),plans:teacher?all.filter(p=>p.status==='Approved'&&teacher.classroom_ids.includes(p.classroom_id)).map(p=>({...p,lessons:p.lessons.filter(l=>p.working_dates[l.day-1]<=new Date(Date.parse(neoToday())+7*86400000).toISOString().slice(0,10))})):all});
 }


 if(request.method!=='POST')return out({error:'Method not allowed.'},405);
 const raw=await request.text();if(raw.length>1500000)return out({error:'Curriculum file is too large.'},413);
 let b;try{b=JSON.parse(raw)}catch{return out({error:'Invalid JSON.'},400)}
 if(!b||typeof b!=='object')return out({error:'Invalid request.'},400);
 if(url.pathname==='/api/learning/plans'){
  if(teacher)return out({error:'Only school administration can prepare curriculum drafts.'},403);
  const classroom=await portalRecord(env,school,'classrooms',b.classroom_id);if(!classroom)return out({error:'Choose a classroom in this school.'},400);
  const data=validateLearningPlan(b);
data.updated_at=new Date().toISOString();
;const id=b.plan_id||crypto.randomUUID();if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))return out({error:'Invalid plan ID.'},400);
  const old=await env.DB.prepare('SELECT school_id,status,data FROM neo_learning_plans WHERE id=?').bind(id).first();
  if(old&&(old.school_id!==school||old.status!=='Draft'))return out({error:'Approved plans are locked. This draft cannot be changed.'},409);
  const sql=old?"UPDATE neo_learning_plans SET classroom_id=?,academic_year=?,data=? WHERE id=? AND school_id=? AND status='Draft' AND data=?":"INSERT INTO neo_learning_plans(classroom_id,academic_year,data,id,school_id) VALUES (?,?,?,?,?)";
  const saved=await env.DB.batch([env.DB.prepare(sql).bind(classroom.id,classroom.academic_year,JSON.stringify(data),id,school,...(old?[old.data]:[])),portalAudit(env,school,admin,'curriculum-draft',id)]);if(Number(saved[0].meta?.changes??saved[0].changes??0)!==1)return out({error:'Curriculum changed. Reload the draft before saving.'},409);
  return out({success:true,id,replaced:!!old,updated_at:data.updated_at,days_covered:new Set(data.lessons.map(l=>l.day)).size},old?200:201);
 }
 if(url.pathname==='/api/learning/activate'){
  if(!schoolSessionValue) return out({error:'Only school administration can activate curriculum.'},403);

  const plan=(await plans()).find(p=>p.id===b.plan_id);
  if(!plan) return out({error:'Plan not found.'},404);
  if(plan.status==='Approved') return out({success:true,status:'Approved'});
  if(plan.status!=='Draft') return out({error:'Only a Draft curriculum can be activated.'},409);

  if(!plan.master_curriculum_id)
    return out({error:'Load and save a Head Office Master Curriculum before activation.'},400);

  const master=await env.DB.prepare(
    'SELECT level,version,status FROM neo_master_curricula WHERE id=?'
  ).bind(plan.master_curriculum_id).first();

  if(!master || !['Published','TestPublished'].includes(master.status))
    return out({error:'The linked Head Office Master Curriculum is not published.'},409);

  if(master.level!==plan.master_level || master.version!==plan.master_version)
    return out({error:'Master Curriculum source does not match this draft.'},409);

  if(plan.working_dates.length!==200)
    return out({error:'Activate requires exactly 200 academic working dates.'},400);

  if(master.status==='Published' && new Set(plan.lessons.map(l=>l.day)).size!==200)
    return out({error:'Published curriculum activation requires all 200 curriculum days.'},400);

  const snapshot=await env.DB.prepare(
    "SELECT id FROM neo_learning_plans WHERE school_id=? AND classroom_id=? AND status='Approved' AND id<>?"
  ).bind(school,plan.classroom_id,plan.id).first();

  const statements=[];
  if(snapshot) statements.push(
    env.DB.prepare(
      "UPDATE neo_learning_plans SET status='Archived' WHERE id=? AND school_id=? AND status='Approved'"
    ).bind(snapshot.id,school)
  );

  statements.push(
    env.DB.prepare(
      "UPDATE neo_learning_plans SET status='Approved' WHERE id=? AND school_id=? AND status='Draft'"
    ).bind(plan.id,school)
  );

  await env.DB.batch(statements);

  return out({
    success:true,
    id:plan.id,
    status:'Approved',
    mode:master.status==='TestPublished'?'Test':'Published'
  });
}
 if(url.pathname==='/api/learning/approve'){
  if(!admin)return out({error:'Head-office approval required.'},403);
  const plan=(await plans()).find(p=>p.id===b.plan_id);if(!plan)return out({error:'Plan not found.'},404);
  if(plan.status==='Approved')return out({success:true});
  if(new Set(plan.lessons.map(l=>l.day)).size!==200)return out({error:'Approval requires at least one concept for every one of the 200 working days.'},400);
  const snapshot=await env.DB.prepare('SELECT data FROM neo_learning_plans WHERE id=? AND school_id=?').bind(plan.id,school).first();const checked=validateLearningPlan(JSON.parse(snapshot.data));if(new Set(checked.lessons.map(l=>l.day)).size!==200)return out({error:'Curriculum changed. Review all 200 days before approval.'},409);const approved=await env.DB.batch([env.DB.prepare("UPDATE neo_learning_plans SET status='Approved' WHERE id=? AND school_id=? AND status='Draft' AND data=?").bind(plan.id,school,snapshot.data),portalAudit(env,school,true,'curriculum-approved',plan.id)]);if(Number(approved[0].meta?.changes??approved[0].changes??0)!==1)return out({error:'Curriculum changed. Reload before approval.'},409);return out({success:true});
 }
 if(url.pathname==='/api/learning/complete'||url.pathname==='/api/learning/defer'){
  if(!teacher)return out({error:'An assigned teacher must confirm the lesson.'},403);
  const plan=(await plans()).find(p=>p.id===b.plan_id&&p.status==='Approved');
  if(!plan||!teacher.classroom_ids.includes(plan.classroom_id))return out({error:'Approved classroom curriculum not assigned to you.'},403);
  const lesson=plan.lessons.find(l=>l.id===b.lesson_id);if(!lesson)return out({error:'Concept not found.'},404);
  const planned=plan.working_dates[lesson.day-1];if(planned>neoToday())return out({error:'A future lesson cannot be marked complete.'},400);
  if(typeof b.comment!=='string'||!b.comment.trim()||b.comment.length>1000)return out({error:'Add a brief teacher comment (up to 1000 characters).'},400);
  if(url.pathname==='/api/learning/defer'){
   if(await env.DB.prepare('SELECT lesson_id FROM neo_learning_completed WHERE plan_id=? AND lesson_id=?').bind(plan.id,lesson.id).first())return out({error:'This concept is already complete.'},409);
   const entry={plan_id:plan.id,lesson_id:lesson.id,classroom_id:plan.classroom_id,concept:lesson.concept,planned_date:planned,date:neoToday(),reason:b.comment.trim(),teacher_name:teacher.name};
   await env.DB.batch([env.DB.prepare('INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'lesson_deferred',crypto.randomUUID(),JSON.stringify(entry)),portalAudit(env,school,false,'lesson-not-completed',plan.id+':'+lesson.id)]);
   return out({success:true},201);
  }
  const data={...lesson,planned_date:planned,completed_date:neoToday(),teacher_name:teacher.name,comment:b.comment.trim()};
  await env.DB.batch([env.DB.prepare('INSERT INTO neo_learning_completed(plan_id,lesson_id,school_id,classroom_id,teacher_id,data) VALUES (?,?,?,?,?,?)').bind(plan.id,lesson.id,school,plan.classroom_id,teacher.account_id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,'teacher:'+teacher.account_id,'concept-completed',plan.id+':'+lesson.id)]);return out({success:true},201);
 }
 if(url.pathname==='/api/learning/comment'){
  if(!teacher)return out({error:'Teacher sign in required.'},403);
  const child=await portalRecord(env,school,'students',b.student_id);
  if(!child||!teacher.classroom_ids.includes(child.classroom_id))return out({error:'Student not assigned to you.'},403);
  if(typeof b.comment!=='string'||!b.comment.trim()||b.comment.length>1000)return out({error:'Enter a comment up to 1000 characters.'},400);
  if(typeof b.request_id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(b.request_id))return out({error:'Invalid submission ID.'},400);
  const data={date:neoToday(),teacher_name:teacher.name,comment:b.comment.trim()};
  await env.DB.batch([env.DB.prepare('INSERT INTO neo_learning_notes(id,school_id,student_id,data) VALUES (?,?,?,?)').bind(b.request_id,school,child.id,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,'teacher:'+teacher.account_id,'parent-comment',child.id)]);return out({success:true},201);
 }
 return out({error:'Not found.'},404);
 }catch(e){if(e instanceof TypeError)return out({error:e.message},400);if(/UNIQUE constraint/.test(String(e.message)))return out({error:'Already saved, or this classroom already has an approved plan. Refresh before retrying.'},409);console.error('Learning portal error',e);return out({error:'Learning workspace unavailable. Check that the latest CRM Worker is deployed.'},503)}
}
async function neoPeriodExecution(request,env,url,a){
  if(url.pathname!=='/api/learning/period-execution')return null;

  const {admin,schoolSessionValue,teacher,parent,school}=a;
  const out=(b,status=200)=>json(b,status,request);

  const cleanText=(v,max=1000)=>{
    if(v===undefined||v===null)return '';
    if(typeof v!=='string')return null;
    const x=v.trim();
    return x.length<=max?x:null;
  };

  const validTime=v=>
    typeof v==='string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

  const executionId=(teacherId,date,classroomId,start)=>
    [
      'PX',
      teacherId,
      date,
      classroomId,
      start.replace(':','')
    ].join('_');

  /*
    READ
    ----
    Teacher: own assigned period records only.
    Parent: only parent_share=true, and only this child.
    School / Head Office: school records.
  */
  if(request.method==='GET'){
    const rows=await portalRows(
      env,
      school,
      'period_execution'
    );

    if(parent){
      const child=await portalRecord(
        env,
        school,
        'students',
        parent.student_id
      );

      if(!child)
        return out({error:'Student not found.'},404);

      const records=rows
  .filter(r=>{
    if(r.classroom_id!==child.classroom_id)return false;

    const childObservation=
      Array.isArray(r.student_observations)
        ? r.student_observations.find(
            x=>x.student_id===parent.student_id
          )
        : null;

    return (
      r.parent_share===true ||
      childObservation?.parent_visible===true ||
      r.homework?.share_with_parent===true
    );
  })
        .map(r=>{
          const observation=Array.isArray(r.student_observations)
            ?r.student_observations.find(
              x=>x.student_id===parent.student_id
            )
            :null;

          return {
            id:r.id,
            date:r.date,
            classroom_id:r.classroom_id,
            start:r.start,
            end:r.end,
            subject:r.subject,
            period_type:r.period_type,
            activity_status:r.activity_status,
            activity_note:r.parent_activity_note||'',
            homework:r.homework?.share_with_parent===true
              ?r.homework
              :null,
            observation:observation||null,
            evidence:Array.isArray(r.evidence)
              ?r.evidence.filter(x=>x.parent_visible===true)
              :[],
            teacher_name:r.teacher_name||'',
            updated_at:r.updated_at||''
          };
        });

      return out({
        today:neoToday(),
        records
      });
    }

    if(teacher){
      return out({
        today:neoToday(),
        records:rows.filter(r=>
          r.teacher_id===teacher.account_id &&
          teacher.classroom_ids.includes(r.classroom_id)
        )
      });
    }

    return out({
      today:neoToday(),
      records:rows
    });
  }

  if(request.method!=='POST')
    return out({error:'Method not allowed.'},405);

  /*
    Only Teacher performs period execution.
    School/HO may read for monitoring but do not impersonate teacher.
  */
  if(!teacher)
    return out({
      error:'Teacher sign in required to update a period.'
    },403);

  const raw=await request.text();

  if(raw.length>120000)
    return out({
      error:'Period update is too large.'
    },413);

  let b;
  try{
    b=JSON.parse(raw);
  }catch{
    return out({error:'Invalid JSON.'},400);
  }

  if(!b||typeof b!=='object'||Array.isArray(b))
    return out({error:'Invalid period update.'},400);

  if(!learningDate(b.date))
    return out({error:'Choose a valid period date.'},400);

  /*
    Tomorrow may be prepared in advance,
    but Conduct/Observe cannot claim future execution.
  */
  const today=neoToday();
  const tomorrow=new Date(
    Date.parse(today)+86400000
  ).toISOString().slice(0,10);

  

  if(
    typeof b.classroom_id!=='string' ||
    !teacher.classroom_ids.includes(b.classroom_id)
  ){
    return out({
      error:'Classroom is not assigned to this teacher.'
    },403);
  }

  const classroom=await portalRecord(
    env,
    school,
    'classrooms',
    b.classroom_id
  );

  if(!classroom)
    return out({error:'Classroom not found.'},404);

  if(
    !validTime(b.start) ||
    !validTime(b.end) ||
    b.start>=b.end
  ){
    return out({
      error:'Check period start and end time.'
    },400);
  }

  const timetable=await portalRecord(
    env,
    school,
    'timetable',
    'weekly-timetable'
  );

  const published=
    Array.isArray(timetable?.published_slots)
      ?timetable.published_slots
      :Array.isArray(timetable?.slots)
        ?timetable.slots
        :[];

  /*
    JS Date: Sunday=0 ... Saturday=6.
    Date string is parsed at UTC midnight intentionally,
    so weekday remains deterministic.
  */
  const weekday=new Date(
    b.date+'T00:00:00Z'
  ).getUTCDay();

  const slot=published.find(s=>
    s.teacher_id===teacher.account_id &&
    s.classroom_id===b.classroom_id &&
    s.weekday===weekday &&
    s.start===b.start &&
    s.end===b.end
  );

  if(!slot)
    return out({
      error:'This period is not in your published timetable.'
    },403);

  const periodType=slot.type;
  const subject=slot.subject;

  const allowedActivity=[
    'Not started',
    'In progress',
    'Completed',
    'Partial',
    'Not conducted',
    'Follow-up needed'
  ];

  const activityStatus=
    typeof b.activity_status==='string'
      ?b.activity_status
      :'Not started';

  if(!allowedActivity.includes(activityStatus))
    return out({
      error:'Choose a valid activity status.'
    },400);

  if(
    b.date>today &&
    !['Not started'].includes(activityStatus)
  ){
    return out({
      error:'Future periods can be prepared, but not marked as conducted.'
    },400);
  }

  const allowedMaterials=[
    'Not checked',
    'Ready',
    'Needs action',
    'Not required'
  ];

  const materialsStatus=
    typeof b.materials_status==='string'
      ?b.materials_status
      :'Not checked';

  if(!allowedMaterials.includes(materialsStatus))
    return out({
      error:'Choose a valid materials status.'
    },400);

  const activityNote=cleanText(b.activity_note,2000);
  const parentActivityNote=cleanText(
    b.parent_activity_note,
    1000
  );
  const materialsNote=cleanText(b.materials_note,1500);
  const teacherNote=cleanText(b.teacher_note,2000);

  if(
    activityNote===null ||
    parentActivityNote===null ||
    materialsNote===null ||
    teacherNote===null
  ){
    return out({
      error:'One of the notes is too long or invalid.'
    },400);
  }

  /*
    Child roster is server-owned.
    Never accept observations for children outside this classroom.
  */
  const children=(await portalRows(
    env,
    school,
    'students'
  )).filter(c=>c.classroom_id===b.classroom_id);

  const childIds=new Set(children.map(c=>c.id));

  if(
    b.student_observations!==undefined &&
    !Array.isArray(b.student_observations)
  ){
    return out({
      error:'Student observations must be a list.'
    },400);
  }

  if(
    Array.isArray(b.student_observations) &&
    b.student_observations.length>children.length
  ){
    return out({
      error:'Too many student observations.'
    },400);
  }

  const allowedOutcome=[
    'Participated',
    'With support',
    'Independent',
    'Needs follow-up',
    'Not observed'
  ];

  const allowedSnack=[
    '',
    'Ate well',
    'Partial',
    'Did not eat',
    'Needed assistance',
    'Not applicable'
  ];

  const seen=new Set();
  const observations=[];

  for(const o of b.student_observations||[]){
    if(
      !o ||
      typeof o.student_id!=='string' ||
      !childIds.has(o.student_id)
    ){
      return out({
        error:'An observation contains a child outside this classroom.'
      },403);
    }

    if(seen.has(o.student_id))
      return out({
        error:'A child can have only one observation per period.'
      },400);

    seen.add(o.student_id);

    if(!allowedOutcome.includes(o.outcome))
      return out({
        error:'Choose a valid child observation outcome.'
      },400);

    const comment=cleanText(o.comment,1000);
    const snackStatus=
      typeof o.snack_status==='string'
        ?o.snack_status
        :'';

    if(comment===null||!allowedSnack.includes(snackStatus))
      return out({
        error:'Check the child observation or snack status.'
      },400);

    observations.push({
      student_id:o.student_id,
      outcome:o.outcome,
      comment,
      snack_status:snackStatus,
      parent_visible:o.parent_visible===true
    });
  }

  /*
    Homework / worksheet metadata.
    File upload itself is NOT faked here.
    attachment_url can only reference an already stored resource.
  */
  let homework=null;

  if(b.homework){
    if(
      typeof b.homework!=='object' ||
      Array.isArray(b.homework)
    ){
      return out({error:'Invalid homework.'},400);
    }

    const title=cleanText(b.homework.title,200);
    const instructions=cleanText(
      b.homework.instructions,
      2000
    );
    const resourceUrl=cleanText(
      b.homework.resource_url,
      1000
    );

    if(
      title===null ||
      instructions===null ||
      resourceUrl===null
    ){
      return out({
        error:'Check homework details.'
      },400);
    }

    let dueDate='';

    if(b.homework.due_date){
      if(!learningDate(b.homework.due_date))
        return out({
          error:'Check homework due date.'
        },400);

      dueDate=b.homework.due_date;
    }

    homework={
      title,
      instructions,
      due_date:dueDate,
      resource_url:resourceUrl,
      share_with_parent:
        b.homework.share_with_parent===true
    };
  }

  /*
    Evidence currently stores references only.
    Actual photo bytes must later go through a real storage endpoint.
  */
  const evidence=[];

  if(b.evidence!==undefined){
    if(!Array.isArray(b.evidence)||b.evidence.length>10)
      return out({
        error:'Provide up to 10 evidence references.'
      },400);

    for(const e of b.evidence){
      const urlValue=cleanText(e?.url,1000);
      const caption=cleanText(e?.caption,300);

      if(
        !urlValue ||
        urlValue===null ||
        caption===null
      ){
        return out({
          error:'Check evidence reference.'
        },400);
      }

      evidence.push({
        url:urlValue,
        caption,
        parent_visible:e.parent_visible===true
      });
    }
  }

  const parentShare=b.parent_share===true;
// Future periods are preparation-only.
// Conduct, observations, homework/evidence and parent sharing
// are allowed only on the scheduled date or after it.
const executionToday = neoToday();

if (b.date > executionToday) {
  const hasFutureExecution =
    (activityStatus && activityStatus !== 'Not started') ||
    !!activityNote ||
    !!parentActivityNote ||
    !!teacherNote ||
    parentShare === true ||
    observations.length > 0 ||
    homework !== null ||
    evidence.length > 0;

  if (hasFutureExecution) {
    return out({
      error:
        'Future periods are preparation only. Conduct, observations, evidence, homework and parent sharing unlock on the scheduled date.'
    }, 400);
  }
}
  /*
    Parent sharing requires at least one parent-safe item.
  */
  if(
    parentShare &&
    !parentActivityNote &&
    !observations.some(o=>o.parent_visible) &&
    !(homework?.share_with_parent) &&
    !evidence.some(e=>e.parent_visible)
  ){
    return out({
      error:'Add at least one parent-visible update before sharing.'
    },400);
  }

  const id=executionId(
    teacher.account_id,
    b.date,
    b.classroom_id,
    b.start
  );

  const old=await portalRecord(
    env,
    school,
    'period_execution',
    id
  );

  /*
    Revision protects teacher from silently overwriting
    another open browser/session.
  */
  const oldRevision=Number(old?.revision||0);

  if(
    !Number.isInteger(b.revision) ||
    b.revision!==oldRevision
  ){
    return out({
      error:'Period update changed. Refresh before saving.'
    },409);
  }

  const now=new Date().toISOString();

  const record={
    date:b.date,
    classroom_id:b.classroom_id,
    classroom_name:classroom.name||'',
    teacher_id:teacher.account_id,
    teacher_name:teacher.name,
    start:b.start,
    end:b.end,
    period_type:periodType,
    subject,
    activity_status:activityStatus,
    activity_note:activityNote,
    parent_activity_note:parentActivityNote,
    materials_status:materialsStatus,
    materials_note:materialsNote,
    teacher_note:teacherNote,
    student_observations:observations,
    homework,
    evidence,
    parent_share:parentShare,
    revision:oldRevision+1,
    updated_at:now,
    created_at:old?.created_at||now
  };

  const sql=`
    INSERT INTO neo_portal_records(
      school_id,kind,id,data
    )
    VALUES(
      ?,'period_execution',?,?
    )
    ON CONFLICT(school_id,kind,id)
    DO UPDATE SET data=excluded.data
    WHERE json_extract(
      neo_portal_records.data,
      '$.revision'
    )=?
  `;

  const result=await env.DB.batch([
    env.DB.prepare(sql).bind(
      school,
      id,
      JSON.stringify(record),
      oldRevision
    ),
    env.DB.prepare(`
      INSERT INTO neo_portal_audit(
        id,school_id,actor,action,record_id
      )
      VALUES(?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      school,
      'teacher:'+teacher.account_id,
      parentShare
        ?'period-execution-shared'
        :'period-execution-saved',
      id
    )
  ]);

  if(
    Number(
      result[0].meta?.changes ??
      result[0].changes ??
      0
    )!==1
  ){
    return out({
      error:'Period update changed. Refresh and try again.'
    },409);
  }

  return out({
    success:true,
    id,
    revision:oldRevision+1,
    parent_share:parentShare,
    updated_at:now
  },old?200:201);
}
async function learningTimetable(request,env,url,actor){
  if(url.pathname!=='/api/learning/timetable')return null;

  const {admin,teacher,parent,school}=actor,
        out=(b,status=200)=>json(b,status,request);

  if(parent){
    if(request.method!=='GET')
      return out({error:'Read-only timetable.'},403);

    const child=await portalRecord(
      env,
      school,
      'students',
      parent.student_id
    );

    if(!child)
      return out({error:'Student record not found.'},404);

    const old=await portalRecord(
      env,
      school,
      'timetable',
      'weekly-timetable'
    );

    const published=
      Array.isArray(old?.published_slots)
        ? old.published_slots
        : Array.isArray(old?.slots)
          ? old.slots
          : [];

    const slots=published.filter(
      s=>s.classroom_id===child.classroom_id
    );

    return out({
      status:old?.status==='Published'?'Published':'Not published',
      revision:Number(old?.revision||0),
      slots:old?.status==='Published'||!old?.status?slots:[],
      periods:[],
      today:neoToday()
    });
  }

  const old=await portalRecord(
    env,
    school,
    'timetable',
    'weekly-timetable'
  );

  const publishedSlots=
    Array.isArray(old?.published_slots)
      ? old.published_slots
      : Array.isArray(old?.slots)
        ? old.slots
        : [];

  const draftSlots=
    Array.isArray(old?.draft_slots)
      ? old.draft_slots
      : publishedSlots;

  if(request.method==='GET'){
    if(teacher){
      const slots=publishedSlots.filter(
        s=>s.teacher_id===teacher.account_id
      );

      return out({
        status:old?.status==='Published'?'Published':'Not published',
        revision:Number(old?.revision||0),
        slots:old?.status==='Published'||!old?.status?slots:[],
        periods:[],
        today:neoToday()
      });
    }

    return out({
      status:old?.status||'Draft',
      revision:Number(old?.revision||0),
      slots:draftSlots,
      published_slots:publishedSlots,
      periods:[],
      today:neoToday(),
      published_at:old?.published_at||null
    });
  }

  if(request.method!=='POST')
    return out({error:'Method not allowed.'},405);

  if(teacher||parent)
    return out({error:'School administration manages the timetable.'},403);

  const raw=await request.text();

  if(raw.length>180000)
    return out({error:'Timetable is too large.'},413);

  let b;

  try{
    b=JSON.parse(raw);
  }catch{
    return out({error:'Invalid JSON.'},400);
  }

  if(
    !b ||
    !Array.isArray(b.slots) ||
    b.slots.length>500 ||
    !Number.isInteger(b.revision) ||
    b.revision!==Number(old?.revision||0)
  ){
    return out({
      error:'Invalid timetable or revision conflict.'
    },409);
  }

  const action=b.action==='publish'?'publish':'save';

  const teachers=(
    await env.DB.prepare(
      'SELECT account_id,classroom_ids FROM neo_teacher_accounts WHERE school_id=? AND active=1'
    ).bind(school).all()
  ).results||[];

  const classrooms=await portalRows(
    env,
    school,
    'classrooms'
  );

  const minute=v=>{
    if(
      typeof v!=='string' ||
      !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v)
    )return NaN;

    const [h,m]=v.split(':').map(Number);
    return h*60+m;
  };

  const slots=[];

  for(const s of b.slots){
    const t=teachers.find(
      t=>t.account_id===s.teacher_id
    );

    if(!t)
      return out({
        error:'Choose an active teacher for every timetable period.'
      },400);

    if(
      !Number.isInteger(s.weekday) ||
      s.weekday<0 ||
      s.weekday>6 ||
      !Number.isFinite(minute(s.start)) ||
      !Number.isFinite(minute(s.end)) ||
      minute(s.start)>=minute(s.end)
    ){
      return out({
        error:'Check weekday and start/end times.'
      },400);
    }

    if(
      !['Teaching','Break','Planning'].includes(s.type) ||
      typeof s.subject!=='string' ||
      !s.subject.trim() ||
      s.subject.trim().length>100
    ){
      return out({
        error:'Check period type and subject / label.'
      },400);
    }

    const c=s.classroom_id
      ? classrooms.find(c=>c.id===s.classroom_id)
      : null;

    if(s.type==='Teaching'){
      if(!c)
        return out({
          error:'Teaching periods need a valid classroom.'
        },400);

      let assigned=[];

      try{
        assigned=JSON.parse(t.classroom_ids||'[]');
      }catch{
        assigned=[];
      }

      if(!assigned.includes(c.id))
        return out({
          error:'Teacher is not assigned to the selected classroom.'
        },400);
    }

    slots.push({
      teacher_id:t.account_id,
      weekday:s.weekday,
      start:s.start,
      end:s.end,
      type:s.type,
      subject:s.subject.trim(),
      classroom_id:c?.id||''
    });
  }

  /*
    Prevent overlapping periods for the same teacher.
  */
  for(let i=0;i<slots.length;i++){
    for(let j=0;j<i;j++){
      const a=slots[i],b=slots[j];

      if(
        a.teacher_id===b.teacher_id &&
        a.weekday===b.weekday &&
        minute(a.start)<minute(b.end) &&
        minute(b.start)<minute(a.end)
      ){
        return out({
          error:'A teacher cannot have overlapping timetable periods.'
        },400);
      }
    }
  }

  const revision=Number(old?.revision||0)+1;

  const now=new Date().toISOString();

  const data=JSON.stringify({
    revision,
    status:action==='publish'
      ?'Published'
      :'Draft',

    draft_slots:slots,

    published_slots:
      action==='publish'
        ?slots
        :publishedSlots,

    /*
      Keep slots for backward compatibility.
      Published data remains authoritative for family accounts.
    */
    slots:
      action==='publish'
        ?slots
        :publishedSlots,

    updated_at:now,

    published_at:
      action==='publish'
        ?now
        :old?.published_at||null
  });

  const sql=`
    INSERT INTO neo_portal_records(
      school_id,
      kind,
      id,
      data
    )
    VALUES(
      ?,
      'timetable',
      'weekly-timetable',
      ?
    )
    ON CONFLICT(school_id,kind,id)
    DO UPDATE SET data=excluded.data
    WHERE json_extract(data,'$.revision')=?
  `;

  const result=await env.DB.prepare(sql)
    .bind(
      school,
      data,
      Number(old?.revision||0)
    )
    .run();

  if(Number(result.meta?.changes||0)!==1)
    return out({
      error:'Timetable changed in another session. Refresh and try again.'
    },409);

  return out({
    success:true,
    status:action==='publish'
      ?'Published'
      :'Draft',
    revision,
    published_at:
      action==='publish'
        ?now
        :old?.published_at||null
  });
}

// Parent concerns share one revisioned history with the responsible classroom and school.
async function neoTickets(request,env,url,a){
 if(url.pathname!=='/api/learning/tickets')return null;
 const {admin,teacher,parent,school}=a,out=(b,status=200)=>json(b,status,request);
 const visible=t=>parent?t.student_id===parent.student_id:teacher?(!t.management_only&&teacher.classroom_ids.includes(t.classroom_id)&&(!t.assigned_teacher_id||t.assigned_teacher_id===teacher.account_id)):true;
 if(request.method==='GET')return out({tickets:(await portalRows(env,school,'parent_tickets')).filter(visible)});
 if(request.method!=='POST')return out({error:'Method not allowed.'},405);
 const raw=await request.text();if(raw.length>10000)return out({error:'Ticket update too large.'},413);
 let b;try{b=JSON.parse(raw)}catch{return out({error:'Invalid JSON.'},400)}
 if(!b||typeof b.message!=='string'||!b.message.trim()||b.message.length>2000)return out({error:'Describe the concern or update (up to 2000 characters).'},400);
 const actor=parent?'Parent':teacher?teacher.name:admin?'Head office':'School administrator',now=new Date().toISOString();
 if(!b.id){
  if(!parent)return out({error:'New concerns are raised from the parent portal.'},403);
  if(typeof b.request_id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(b.request_id))return out({error:'Invalid request ID.'},400);
  if(typeof b.subject!=='string'||!b.subject.trim()||b.subject.length>160||!['Learning','Attendance','Fees','Transport','Books / uniform','Staff concern','Other'].includes(b.category))return out({error:'Select category and enter a subject.'},400);
  const child=await portalRecord(env,school,'students',parent.student_id);if(!child)return out({error:'Child not found.'},404);
  const data={student_id:child.id,child_name:child.name,classroom_id:child.classroom_id||'',subject:b.subject.trim(),category:b.category,management_only:b.category==='Staff concern',assigned_teacher_id:'',status:'Open',revision:1,updated_at:now,history:[{actor,date:now,status:'Open',message:b.message.trim()}]};
  if(await portalRecord(env,school,'parent_tickets',b.request_id))return out({error:'Already submitted. Refresh your tickets.'},409);
  const writes=[env.DB.prepare('INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(school,'parent_tickets',b.request_id,JSON.stringify(data)),portalAudit(env,school,false,'parent-ticket-created',b.request_id)];
  if(b.category==='Books / uniform'){writes.push(portalNotification(env,school,'school','Student kit issue reported',child.name+' reported a missing, damaged or wrong kit item.','parent_tickets',b.request_id,'Unread','tickets'));writes.push(portalNotification(env,school,'head-office','Center student kit issue',child.name+' at '+school+' reported a complete-kit material issue.','parent_tickets',b.request_id,'Unread','tickets'));}
  await env.DB.batch(writes);
  return out({success:true,id:b.request_id},201);
 }
 const old=await portalRecord(env,school,'parent_tickets',b.id);if(!old||!visible(old))return out({error:'Ticket not found.'},404);
 if(b.revision!==old.revision)return out({error:'Another person updated this ticket. Refresh before saving.'},409);
 const allowed=parent?['Reply',...(['Resolved','Closed'].includes(old.status)?['Reopen']:[]),...(old.status==='Resolved'?['Closed']:[])]:teacher?['Reply','In progress','Waiting for parent','Resolved']:['Reply','In progress','Waiting for parent','Resolved','Closed','Reopen','Assign'];
 if(!allowed.includes(b.action))return out({error:'This ticket action is not available to your role.'},403);
 if(old.status==='Closed'&&b.action!=='Reopen')return out({error:'Reopen the ticket before adding updates.'},409);
 const next={...old,revision:old.revision+1,updated_at:now};delete next.id;delete next.created_at;
 if(b.action==='Assign'){
  const ta=await env.DB.prepare('SELECT account_id,classroom_ids FROM neo_teacher_accounts WHERE school_id=? AND account_id=? AND active=1').bind(school,b.teacher_id||'').first();
  if(!ta||!JSON.parse(ta.classroom_ids).includes(old.classroom_id)||old.management_only)return out({error:'Choose an active teacher assigned to this classroom. Staff concerns stay with management.'},400);
  next.assigned_teacher_id=ta.account_id;
 }else if(b.action!=='Reply')next.status=b.action==='Reopen'?'Open':b.action;
 next.history=[...old.history,{actor,date:now,status:next.status,message:b.message.trim(),action:b.action}];
 const result=await env.DB.batch([env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='parent_tickets' AND id=? AND json_extract(data,'$.revision')=?").bind(JSON.stringify(next),school,b.id,old.revision),portalAudit(env,school,admin,'ticket-'+b.action,b.id)]);
 if(Number(result[0].meta?.changes??result[0].changes??0)!==1)return out({error:'Ticket changed. Refresh and retry.'},409);
 return out({success:true,id:b.id});
}

async function neoCalendar(request,env,url,{admin,teacher,parent,school}){
 if(url.pathname!=='/api/learning/calendar')return null;
 const out=(b,status=200)=>json(b,status,request),old=await portalRecord(env,school,'calendar','school-calendar');
 if(request.method==='GET')return out({revision:old?.revision||0,events:old?.events||[],today:neoToday()});
 if(teacher||parent)return out({error:'School administration manages the calendar.'},403);
 if(request.method!=='POST')return out({error:'Method not allowed.'},405);
 const raw=await request.text();if(raw.length>300000)return out({error:'Calendar is too large.'},413);
 let b;try{b=JSON.parse(raw)}catch{return out({error:'Invalid JSON.'},400)}
 if(!b||b.revision!==(old?.revision||0))return out({error:'Calendar changed. Refresh before saving.'},409);
 if(!Array.isArray(b.events)||b.events.length>500)return out({error:'Provide up to 500 events.'},400);
 const types=['Holiday','PTM','Meeting','Celebration','Event','Academic','Assessment','Exam','School reopening','Other'];
 const events=[];for(const e of b.events){if(!e||!learningDate(e.date)||typeof e.title!=='string'||!e.title.trim()||e.title.length>160||!types.includes(e.type)||typeof e.description!=='string'||e.description.length>2000)return out({error:'Each event needs a date, title, valid category and description (up to 2000 characters).'},400);events.push({date:e.date,title:e.title.trim(),type:e.type,description:e.description});}
 events.sort((a,b)=>a.date.localeCompare(b.date));const revision=(old?.revision||0)+1;
 const result=await env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'calendar','school-calendar',?) ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data WHERE json_extract(neo_portal_records.data,'$.revision')=?").bind(school,JSON.stringify({events,revision}),old?.revision||0).run();
 if(Number(result.meta?.changes??result.changes??0)!==1)return out({error:'Calendar changed. Refresh before saving.'},409);
 return out({success:true,revision});
}

async function neoAcademicCalendar(request,env,url,{admin,teacher,parent,school}){
  if(url.pathname!=='/api/learning/academic-calendar')return null;

  const out=(b,status=200)=>json(b,status,request);
  const id='academic-calendar';
  const old=await portalRecord(env,school,'academic_calendar',id);

  if(request.method==='GET'){
    if(teacher||parent){
      if(!old||old.status!=='Published'){
        return out({
          status:'Not published',
          revision:old?.revision||0,
          working_dates:[],
          today:neoToday()
        });
      }

      return out({
        academic_year:old.academic_year,
        status:old.status,
        revision:old.revision,
        working_dates:old.working_dates,
        published_at:old.published_at||'',
        today:neoToday()
      });
    }

    return out({
      academic_year:old?.academic_year||'',
      status:old?.status||'Not saved',
      revision:old?.revision||0,
      working_dates:old?.working_dates||[],
      published_at:old?.published_at||'',
      today:neoToday()
    });
  }

  if(teacher||parent)
    return out({
      error:'School administration manages the academic calendar.'
    },403);

  if(request.method!=='POST')
    return out({error:'Method not allowed.'},405);

  const raw=await request.text();

  if(raw.length>300000)
    return out({error:'Academic calendar is too large.'},413);

  let b;

  try{
    b=JSON.parse(raw);
  }catch{
    return out({error:'Invalid JSON.'},400);
  }

  if(!b||typeof b!=='object')
    return out({error:'Invalid academic calendar.'},400);

  if(!Number.isInteger(b.revision)||b.revision!==(old?.revision||0))
    return out({
      error:'Academic calendar changed. Refresh before saving.'
    },409);

  if(typeof b.academic_year!=='string'||!/^20\d{2}$/.test(b.academic_year))
    return out({
      error:'Enter a valid academic starting year.'
    },400);

  if(
    !Array.isArray(b.working_dates)||
    b.working_dates.length!==200||
    !b.working_dates.every(learningDate)||
    b.working_dates.some((d,i)=>i>0&&d<=b.working_dates[i-1])
  ){
    return out({
      error:'Provide exactly 200 unique working dates in chronological order.'
    },400);
  }

  if(
    Date.parse(b.working_dates[199])-Date.parse(b.working_dates[0])
    >730*86400000
  ){
    return out({
      error:'Academic calendar must fit within two years.'
    },400);
  }

  const action=b.action==='publish'?'publish':'save';
  const now=new Date().toISOString();
  const revision=(old?.revision||0)+1;

  const data={
    academic_year:b.academic_year,
    working_dates:b.working_dates,
    status:action==='publish'?'Published':'Draft',
    revision,
    updated_at:now,
    published_at:
      action==='publish'
        ?now
        :(old?.published_at||'')
  };

  const sql=
    "INSERT INTO neo_portal_records(school_id,kind,id,data) "+
    "VALUES (?,'academic_calendar',?,?) "+
    "ON CONFLICT(school_id,kind,id) DO UPDATE SET data=excluded.data "+
    "WHERE json_extract(neo_portal_records.data,'$.revision')=?";

  const result=await env.DB.batch([
    env.DB.prepare(sql).bind(
      school,
      id,
      JSON.stringify(data),
      old?.revision||0
    ),
    portalAudit(
      env,
      school,
      admin,
      action==='publish'
        ?'academic-calendar-published'
        :'academic-calendar-draft',
      id
    )
  ]);

  if(Number(result[0].meta?.changes??result[0].changes??0)!==1){
    return out({
      error:'Academic calendar changed. Refresh before saving.'
    },409);
  }

  return out({
    success:true,
    status:data.status,
    revision,
    academic_year:data.academic_year,
    working_dates:data.working_dates,
    published_at:data.published_at
  });
}

/* Transport phase 1: school-controlled routes and manifests; driver trip events;
   child-scoped parent view. GPS is intentionally outside this workflow. */
async function transportPortal(request,env,url){
 if(!url.pathname.startsWith('/api/transport/'))return null;
 const out=(body,status=200)=>json(body,status,request);
 try{
  await ensurePortalSchema(env);
  await env.DB.batch([
   env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS neo_transport_trip_run_once ON neo_portal_records(school_id,json_extract(data,'$.route_id'),json_extract(data,'$.date'),json_extract(data,'$.direction'),COALESCE(json_extract(data,'$.run_no'),1)) WHERE kind='transport_trips'"),
   env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS neo_transport_child_once ON neo_portal_records(school_id,json_extract(data,'$.student_id')) WHERE kind='transport_assignments' AND json_extract(data,'$.active')=1"),
   env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS neo_transport_vehicle_once ON neo_portal_records(school_id,json_extract(data,'$.registration_no')) WHERE kind='transport_vehicles' AND json_extract(data,'$.active')=1")
  ]);
  const parts=url.pathname.split('/').filter(Boolean),scope=parts[2],kind=parts[3],id=parts[4];
  const admin=await requireAdmin(request,env),school=admin?null:await schoolSession(request,env);
  const parent=!admin&&!school?await parentSession(request,env):null;
  if(!admin&&!school&&!parent)return out({error:'Sign in required.'},401);
  if(scope==='parent'&&request.method==='GET'&&kind==='me'){
   if(!parent)return out({error:'Parent access required.'},403);
   const assignments=(await portalRows(env,parent.school_id,'transport_assignments')).filter(a=>a.student_id===parent.student_id&&a.active);
   const routeIds=new Set(assignments.map(a=>a.route_id));
   const routes=(await portalRows(env,parent.school_id,'transport_routes')).filter(r=>routeIds.has(r.id)&&r.active);
   const vehicleIds=new Set(routes.map(r=>r.vehicle_id));
   const vehicles=(await portalRows(env,parent.school_id,'transport_vehicles')).filter(v=>vehicleIds.has(v.id));
   const trips=(await portalRows(env,parent.school_id,'transport_trips')).filter(t=>assignments.some(a=>a.route_id===t.route_id&&Number(a.run_no||1)===Number(t.run_no||1))&&t.date===neoToday()).map(t=>({...t,events:(t.events||[]).filter(e=>e.student_id===parent.student_id)}));
   const alerts=(await portalRows(env,parent.school_id,'transport_alerts')).filter(n=>n.student_id===parent.student_id&&n.date===neoToday()).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
   return out({assignments,routes,vehicles,trips,alerts});
  }
  if(scope!=='school'||!kind||!['routes','vehicles','assignments','trips'].includes(kind))return out({error:'Not found.'},404);
  const schoolId=parts[4]; // /api/transport/school/:kind/:school_id[/id]
  const recordId=parts[5];
  if(!schoolId)return out({error:'School required.'},400);
  if(!admin&&(!school||school.school_id!==schoolId))return out({error:'Access denied.'},403);
  if(!await env.DB.prepare('SELECT school_id FROM neo_schools WHERE school_id=?').bind(schoolId).first())return out({error:'School not found.'},404);
  const dbKind='transport_'+kind,read=async(k,rid)=>portalRecord(env,schoolId,'transport_'+k,rid);
  if(request.method==='GET'){
   const [routes,vehicles,assignments,trips,students,staff,classrooms]=await Promise.all(['routes','vehicles','assignments','trips'].map(k=>portalRows(env,schoolId,'transport_'+k)).concat([portalRows(env,schoolId,'students'),portalRows(env,schoolId,'staff'),portalRows(env,schoolId,'classrooms')]));
   return out({routes,vehicles,assignments,trips,students:students.map(s=>({id:s.id,name:s.name,program:s.program,classroom_id:s.classroom_id||''})),classrooms:classrooms.map(c=>({id:c.id,name:c.name,program:c.program,academic_year:c.academic_year})),staff:staff.map(s=>({id:s.id,name:s.name,status:s.status,department:s.department,staff_type:s.staff_type}))});
  }
  if(!['POST','PATCH'].includes(request.method))return out({error:'Method not allowed.'},405);
  const raw=await request.text();if(raw.length>12000)return out({error:'Request too large.'},413);
  let b;try{b=JSON.parse(raw)}catch{return out({error:'Invalid JSON.'},400)}
  if(!b||typeof b!=='object'||Array.isArray(b))return out({error:'Invalid record.'},400);
  const val=(k,max=160)=>typeof b[k]==='string'?b[k].trim().slice(0,max+1):'';
  const required=(k,max=160)=>{const v=val(k,max);if(!v||v.length>max)throw Error('Check '+k+'.');return v};
  const actor=admin?'head-office':'school:'+schoolId;
  const now=new Date().toISOString();
  if(request.method==='POST'){
   const rid=required('request_id',80);if(!/^[A-Za-z0-9_-]{8,80}$/.test(rid))return out({error:'Invalid request ID.'},400);
   if(await read(kind,rid))return out({error:'Submission already exists.'},409);
   let data;
   if(kind==='vehicles'){
    const expiry=k=>{const v=required(k,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Check '+k+'.');return v};
    data={registration_no:required('registration_no',30).toUpperCase(),label:required('label'),capacity:Number(b.capacity),insurance_expiry:expiry('insurance_expiry'),pollution_expiry:expiry('pollution_expiry'),fitness_expiry:expiry('fitness_expiry'),tax_expiry:expiry('tax_expiry'),active:true};
    if(!Number.isInteger(data.capacity)||data.capacity<1||data.capacity>100)return out({error:'Capacity must be 1–100.'},400);
    if((await portalRows(env,schoolId,dbKind)).some(v=>v.registration_no===data.registration_no&&v.active))return out({error:'Vehicle registration already exists.'},409);
   }else if(kind==='routes'){
    const vehicle=await read('vehicles',required('vehicle_id',80)),driver=await portalRecord(env,schoolId,'staff',required('driver_staff_id',80));
    if(!vehicle?.active||!driver||driver.status==='Inactive')return out({error:'Choose an active vehicle and staff driver.'},400);
    const stops=b.stops;if(!Array.isArray(stops)||!stops.length||stops.length>40||stops.some(s=>typeof s!=='string'||!s.trim()||s.length>100))return out({error:'Add 1–40 route stops.'},400);
    const attendantId=val('attendant_staff_id',80),attendant=attendantId?await portalRecord(env,schoolId,'staff',attendantId):null,tripCount=Number(b.trip_count||1);
    if(attendantId&&(!attendant||attendant.status==='Inactive'||attendant.id===driver.id))return out({error:'Choose a different active Staff member as the vehicle attendant.'},400);
    if(![1,2].includes(tripCount))return out({error:'Choose one or two daily trip runs.'},400);
    data={name:required('name'),vehicle_id:vehicle.id,driver_staff_id:driver.id,attendant_staff_id:attendant?.id||'',trip_count:tripCount,stops:stops.map(s=>s.trim()),active:true};
   }else if(kind==='assignments'){
    const route=await read('routes',required('route_id',80)),student=await portalRecord(env,schoolId,'students',required('student_id',80)),classroom=await portalRecord(env,schoolId,'classrooms',required('classroom_id',80)),stop=required('stop',100);
    if(!route?.active||!student||!classroom||student.classroom_id!==classroom.id||student.program!==classroom.program||!route.stops.includes(stop))return out({error:'Choose a student from the selected class and section, and a stop on an active route.'},400);
    if((await portalRows(env,schoolId,dbKind)).some(a=>a.student_id===student.id))return out({error:'This child already has a locked transport assignment.'},409);
    const runNo=Number(b.run_no||1);if(!Number.isInteger(runNo)||runNo<1||runNo>Number(route.trip_count||1))return out({error:'Select a valid trip run for this route.'},400);
    const count=(await portalRows(env,schoolId,dbKind)).filter(a=>a.active&&a.route_id===route.id&&Number(a.run_no||1)===runNo).length,vehicle=await read('vehicles',route.vehicle_id);
    if(count>=Number(vehicle?.capacity||0))return out({error:'Vehicle capacity reached for this trip run.'},409);
    data={route_id:route.id,student_id:student.id,classroom_id:classroom.id,program:classroom.program,stop,run_no:runNo,active:true};
   }else{
    return out({error:'Trips are started and finished only from the Driver Portal.'},403);
   }
   await env.DB.batch([env.DB.prepare('INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').bind(schoolId,dbKind,rid,JSON.stringify(data)),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),schoolId,actor,'POST:'+dbKind,rid)]);
   return out({success:true,id:rid,record:data},201);
  }
  if(!recordId)return out({error:'Record ID required.'},400);
  const previous=await read(kind,recordId);if(!previous)return out({error:'Record not found.'},404);
  if(kind==='trips')return out({error:'Daily trips are operated only from the Driver Portal.'},403);
  let data;
  if(kind==='assignments')return out({error:'A saved child transport route is locked and cannot be changed.'},403);
  if(kind==='vehicles'||kind==='routes'){
   if(b.active!==false)return out({error:'Only deactivation is supported. Create a new record for changes.'},400);
   if(kind==='routes'&&(await portalRows(env,schoolId,'transport_assignments')).some(a=>a.active&&a.route_id===recordId))return out({error:'This route has assigned children and is locked.'},409);
   if(kind==='routes'&&(await portalRows(env,schoolId,'transport_trips')).some(t=>t.route_id===recordId&&t.date===neoToday()&&t.status!=='Completed'))return out({error:'Complete today’s trip first.'},409);
   data={...previous,active:false,updated_at:now};
  }else{
   const eventType=val('event_type',30),studentId=val('student_id',80),next=eventType?'':required('status',40),arrival=previous.direction==='Pickup'?['Arrived school']:[],allowed={Planned:['Started'],Started:['Approaching','At stop',...arrival,'Completed'],Approaching:['At stop',...arrival,'Completed'],'At stop':['Approaching',...arrival,'Completed'],'Arrived school':['Completed'],Completed:[]};
   if(eventType){
    const valid=previous.direction==='Pickup'?['Ready','Picked up','Dropped at school','Absent']:['Boarded at school','Dropped at stop','Absent'];
    if(previous.status==='Planned'||previous.status==='Completed'||!valid.includes(eventType))return out({error:'Start the trip and choose a valid child event.'},409);
    const assignment=(await portalRows(env,schoolId,'transport_assignments')).find(a=>a.active&&a.route_id===previous.route_id&&a.student_id===studentId);
    if(!assignment)return out({error:'Child is not assigned to this route.'},403);
    const already=(previous.events||[]).some(e=>e.student_id===studentId&&e.type===eventType);
    if(already)return out({error:'Child event already recorded.'},409);
    data={...previous,events:[...(previous.events||[]),{student_id:studentId,type:eventType,at:now,actor}]};
   }else{
    if(!allowed[previous.status]?.includes(next))return out({error:'Invalid trip transition.'},409);
    if(next==='Completed'){
     const children=(await portalRows(env,schoolId,'transport_assignments')).filter(a=>a.active&&a.route_id===previous.route_id);
     const terminal=previous.direction==='Pickup'?'Dropped at school':'Dropped at stop';
     if(children.some(a=>!(previous.events||[]).some(e=>e.student_id===a.student_id&&[terminal,'Absent'].includes(e.type))))return out({error:'Record each child as dropped or absent before completing this trip.'},409);
    }
    data={...previous,status:next,started_at:next==='Started'?now:previous.started_at,completed_at:next==='Completed'?now:null,updated_at:now};
   }
  }
  const oldJson=JSON.stringify((({id,created_at,...rest})=>rest)(previous));
  const cleanData=(({id,created_at,...rest})=>rest)(data);
  const result=await env.DB.prepare('UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind=? AND id=? AND data=?').bind(JSON.stringify(cleanData),schoolId,dbKind,recordId,oldJson).run();
  if(!result.meta?.changes)return out({error:'Record changed. Refresh and retry.'},409);
  await env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),schoolId,actor,'PATCH:'+dbKind,recordId).run();
  return out({success:true,record:cleanData});
 }catch(e){console.error('Transport error',e);return out({error:e?.message||'Transport request failed.'},400)}
}

/* Dedicated, route-scoped transport accounts and today's operations. */
const transportSchemaReady=new WeakMap();
async function ensureTransportSchema(env){
 if(!transportSchemaReady.has(env.DB))transportSchemaReady.set(env.DB,(async()=>{
  await env.DB.batch([
   env.DB.prepare('CREATE TABLE IF NOT EXISTS neo_login_attempts(school_id TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires INTEGER NOT NULL)'),
   env.DB.prepare("CREATE TABLE IF NOT EXISTS neo_transport_accounts(account_id TEXT PRIMARY KEY,school_id TEXT NOT NULL,staff_id TEXT NOT NULL,role TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
   env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS neo_transport_staff_account ON neo_transport_accounts(school_id,staff_id)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS neo_transport_photos(trip_id TEXT NOT NULL,phase TEXT NOT NULL,school_id TEXT NOT NULL,photo BLOB NOT NULL,PRIMARY KEY(trip_id,phase))')
  ]);
  await env.DB.prepare('DROP INDEX IF EXISTS neo_transport_trip_once').run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS neo_transport_trip_run_once ON neo_portal_records(school_id,json_extract(data,'$.route_id'),json_extract(data,'$.date'),json_extract(data,'$.direction'),COALESCE(json_extract(data,'$.run_no'),1)) WHERE kind='transport_trips'").run();
 })().catch(e=>{transportSchemaReady.delete(env.DB);throw e}));
 return transportSchemaReady.get(env.DB);
}
async function transportOperations(request,env,url){
 const path=url.pathname;if(!path.startsWith('/api/transport/'))return null;
 const parts=path.split('/').filter(Boolean),section=parts[2],action=parts[3];
 if(!['login','driver','school','photo'].includes(section)||section==='school'&&!['access','compliance'].includes(action))return null;
 const out=(b,s=200)=>json(b,s,request);
 try{
  await ensurePortalSchema(env);
  await ensureTransportSchema(env);
  if(section==='login'&&request.method==='POST'){
   const b=await request.json(),id=String(b.account_id||'').trim().toUpperCase();
   if(!/^ND-[A-Z0-9-]{8,32}$/.test(id)||typeof b.password!=='string'||b.password.length>128)return out({error:'Check transport ID and password.'},400);
   const now=Date.now(),attempt=await env.DB.prepare('INSERT INTO neo_login_attempts(school_id,attempts,expires) VALUES (?,1,?) ON CONFLICT(school_id) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END,expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts').bind('TRANSPORT:'+id,now+900000,now,now,now+900000).first();
   if(attempt.attempts>10)return out({error:'Too many attempts. Try again after 15 minutes.'},429);
   const a=await env.DB.prepare('SELECT a.* FROM neo_transport_accounts a JOIN neo_schools s ON s.school_id=a.school_id WHERE a.account_id=? AND a.active=1 AND s.active=1').bind(id).first();
   if(!a||await schoolPassword(b.password,a.salt)!==a.password_hash)return out({error:'Check transport ID and password.'},401);
   const payload=base64urlEncode(JSON.stringify({role:'transport',account_id:id,version:a.password_hash,exp:Date.now()+8*3600000}));
   const signature=base64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC',await getSigningKey(env.ADMIN_PASSWORD),new TextEncoder().encode(payload))));
   return out({token:payload+'.'+signature});
  }
  const admin=await requireAdmin(request,env),school=admin?null:await schoolSession(request,env);
  if(section==='school'){
   const schoolId=parts[4];if(!schoolId||!admin&&school?.school_id!==schoolId)return out({error:'School access required.'},403);
   if(action==='access'){
    if(request.method==='GET'){const rows=await env.DB.prepare('SELECT account_id,staff_id,role,active,created_at FROM neo_transport_accounts WHERE school_id=? ORDER BY created_at DESC').bind(schoolId).all();return out({accounts:rows.results||[]})}
    if(request.method!=='POST')return out({error:'Method not allowed.'},405);
    const b=await request.json(),staffId=String(b.staff_id||''),role=String(b.role||''),staff=await portalRecord(env,schoolId,'staff',staffId);
    if(!staff||staff.status==='Inactive'||!['Driver','Attendant'].includes(role)||!strongPortalPassword(b.password))return out({error:'Choose active staff, a role and a strong password.'},400);
    const routes=(await portalRows(env,schoolId,'transport_routes')).filter(r=>r.active&&(role==='Driver'?r.driver_staff_id===staffId:r.attendant_staff_id===staffId));
    if(!routes.length)return out({error:'Assign this staff member to a route first.'},400);
    const existing=await env.DB.prepare('SELECT account_id FROM neo_transport_accounts WHERE school_id=? AND staff_id=?').bind(schoolId,staffId).first();
    const id=existing?.account_id||'ND-'+crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase(),salt=crypto.randomUUID(),hash=await schoolPassword(b.password,salt);
    await env.DB.batch([env.DB.prepare('INSERT INTO neo_transport_accounts(account_id,school_id,staff_id,role,salt,password_hash,active) VALUES (?,?,?,?,?,?,1) ON CONFLICT(account_id) DO UPDATE SET role=excluded.role,salt=excluded.salt,password_hash=excluded.password_hash,active=1').bind(id,schoolId,staffId,role,salt,hash),portalAudit(env,schoolId,!school,'transport-access',id)]);
    return out({account_id:id,staff_id:staffId,role,success:true},existing?200:201);
   }
   if(action==='compliance'&&request.method==='PATCH'){
    const vehicle=await portalRecord(env,schoolId,'transport_vehicles',parts[5]);if(!vehicle)return out({error:'Vehicle not found.'},404);
    const b=await request.json(),dates={};for(const k of ['insurance_expiry','pollution_expiry','fitness_expiry','tax_expiry']){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(b[k]||''))||!Number.isFinite(Date.parse(b[k])))return out({error:'Enter all four valid renewal dates.'},400);dates[k]=b[k]}
    const current=JSON.stringify((({id,created_at,...data})=>data)(vehicle)),next={...JSON.parse(current),...dates,updated_at:new Date().toISOString()};
    const result=await env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='transport_vehicles' AND id=? AND data=?").bind(JSON.stringify(next),schoolId,vehicle.id,current).run();
    if(!result.meta?.changes)return out({error:'Vehicle changed. Refresh and retry.'},409);
    await portalAudit(env,schoolId,!school,'transport-compliance',vehicle.id).run();return out({success:true,record:next});
   }
   return out({error:'Not found.'},404);
  }
  let transport=null;
  try{const p=(request.headers.get('Authorization')||'').replace(/^Bearer /,'').split('.');if(p.length===2&&await crypto.subtle.verify('HMAC',await getSigningKey(env.ADMIN_PASSWORD),base64urlDecode(p[1]),new TextEncoder().encode(p[0]))){const claim=JSON.parse(new TextDecoder().decode(base64urlDecode(p[0])));if(claim.role==='transport'&&claim.exp>Date.now()){const a=await env.DB.prepare('SELECT a.* FROM neo_transport_accounts a JOIN neo_schools s ON s.school_id=a.school_id WHERE a.account_id=? AND a.active=1 AND s.active=1').bind(claim.account_id).first();if(a?.password_hash===claim.version)transport=a}}}catch{}
  if(section==='photo'){
   if(!transport&&!school&&!admin)return out({error:'Sign in required.'},401);
   const tripId=action,phase=parts[4];if(!['start','finish'].includes(phase))return out({error:'Not found.'},404);
   const image=await env.DB.prepare('SELECT school_id,photo FROM neo_transport_photos WHERE trip_id=? AND phase=?').bind(tripId,phase).first();
   if(!image||!admin&&image.school_id!==(school?.school_id||transport?.school_id))return out({error:'Photo not found.'},404);
   if(transport){const trip=await portalRecord(env,image.school_id,'transport_trips',tripId),route=trip&&await portalRecord(env,image.school_id,'transport_routes',trip.route_id);if(!route||![route.driver_staff_id,route.attendant_staff_id].includes(transport.staff_id))return out({error:'Access denied.'},403)}
   return new Response(new Uint8Array(image.photo),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store'}});
  }
  if(!transport)return out({error:'Transport sign in required.'},401);
  const staff=await portalRecord(env,transport.school_id,'staff',transport.staff_id);if(!staff||staff.status==='Inactive')return out({error:'Staff profile unavailable.'},403);
  const schoolId=transport.school_id,today=neoToday(),routes=(await portalRows(env,schoolId,'transport_routes')).filter(r=>r.active&&[r.driver_staff_id,r.attendant_staff_id].includes(transport.staff_id));
  const routeIds=new Set(routes.map(r=>r.id)),allAssignments=(await portalRows(env,schoolId,'transport_assignments')).filter(a=>a.active&&routeIds.has(a.route_id)),allTrips=(await portalRows(env,schoolId,'transport_trips')).filter(t=>t.date===today&&routeIds.has(t.route_id));
  const vehicleIds=new Set(routes.map(r=>r.vehicle_id)),vehicles=(await portalRows(env,schoolId,'transport_vehicles')).filter(v=>vehicleIds.has(v.id));
  const allStudents=await portalRows(env,schoolId,'students'),studentIds=new Set(allAssignments.map(a=>a.student_id)),students=allStudents.filter(s=>studentIds.has(s.id)).map(s=>({id:s.id,name:s.name}));
  const ordered=(route,run,direction)=>allAssignments.filter(a=>a.route_id===route.id&&Number(a.run_no||1)===run).sort((a,b)=>{const x=route.stops.indexOf(a.stop),y=route.stops.indexOf(b.stop);return (direction==='Drop'?y-x:x-y)||String(a.created_at).localeCompare(String(b.created_at))||a.id.localeCompare(b.id)});
  if(action==='me'&&request.method==='GET'){
   const reminders=vehicles.flatMap(v=>['insurance','pollution','fitness','tax'].map(k=>{const date=v[k+'_expiry'],days=date?Math.ceil((Date.parse(date+'T00:00:00+05:30')-Date.now())/86400000):null;return {vehicle_id:v.id,type:k,date:date||null,days_remaining:days}}).filter(r=>r.days_remaining===null||r.days_remaining<=30));
   return out({account_id:transport.account_id,name:staff.name,role:transport.role,school_id:schoolId,routes,vehicles,assignments:allAssignments,students,trips:allTrips,reminders});
  }
  if(request.method!=='POST'||!['start','event','finish'].includes(action))return out({error:'Not found.'},404);
  const raw=await request.text();if(raw.length>230000)return out({error:'Photo request too large.'},413);
  let b;try{b=JSON.parse(raw)}catch{return out({error:'Invalid JSON.'},400)}
  const photo=()=>{if(typeof b.photo!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(b.photo)||b.photo.length>205000)throw Error('Capture a JPEG photo under 150 KB.');const decoded=atob(b.photo.split(',')[1]);if(decoded.length>150000||decoded.length<4||decoded.charCodeAt(0)!==255||decoded.charCodeAt(1)!==216||decoded.charCodeAt(decoded.length-2)!==255||decoded.charCodeAt(decoded.length-1)!==217)throw Error('Capture a valid JPEG photo under 150 KB.');return Uint8Array.from(decoded,c=>c.charCodeAt(0))};
  const reading=()=>{const n=Number(b.odometer_km);if(!Number.isSafeInteger(n)||n<0||n>9999999)throw Error('Enter the odometer reading in whole kilometres.');return n};
  const actor='transport:'+transport.account_id,now=new Date().toISOString();
  if(action==='start'){
   const route=routes.find(r=>r.id===b.route_id),direction=b.direction,run=Number(b.run_no||1);
   if(!route||!['Pickup','Drop'].includes(direction)||!Number.isInteger(run)||run<1||run>Number(route.trip_count||1))return out({error:'Choose an assigned route, direction and trip run.'},400);
   const children=ordered(route,run,direction);if(!children.length)return out({error:'No children assigned to this trip run.'},409);
   const vehicle=vehicles.find(v=>v.id===route.vehicle_id),expired=['insurance','pollution','fitness','tax'].filter(k=>!vehicle?.[k+'_expiry']||vehicle[k+'_expiry']<today);
   if(expired.length)return out({error:'Vehicle documents need school renewal: '+expired.join(', ')+'.'},409);
   if(b.fuel_ok!==true||b.tyres_ok!==true||b.condition_ok!==true)return out({error:'Complete fuel, tyre air and vehicle condition checks.'},400);
   const km=reading(),picture=photo(),id=crypto.randomUUID(),record={route_id:route.id,vehicle_id:vehicle.id,direction,run_no:run,date:today,status:'Started',odometer_start_km:km,checks:{fuel:true,tyres:true,condition:true},events:[],started_at:now,started_by:actor};
   if(allTrips.some(t=>t.route_id===route.id&&t.direction===direction&&Number(t.run_no||1)===run))return out({error:'This trip run has already started today.'},409);
   const inserts=[env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'transport_trips',?,?)").bind(schoolId,id,JSON.stringify(record)),env.DB.prepare("INSERT INTO neo_transport_photos(trip_id,phase,school_id,photo) VALUES (?,'start',?,?)").bind(id,schoolId,picture),portalAudit(env,schoolId,false,'transport-start',id)];
   for(const [i,child] of children.entries())inserts.push(env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'transport_alerts',?,?)").bind(schoolId,crypto.randomUUID(),JSON.stringify({student_id:child.student_id,route_id:route.id,trip_id:id,date:today,at:now,message:'Your '+(direction==='Pickup'?'pickup':'return')+' vehicle has started. Your child is '+(i+1)+' of '+children.length+' scheduled stops.',remaining:children.length})));
   await env.DB.batch(inserts);return out({success:true,id,record},201);
  }
  const trip=allTrips.find(t=>t.id===b.trip_id),route=trip&&routes.find(r=>r.id===trip.route_id);if(!trip||!route)return out({error:'Assigned trip not found today.'},404);
  if(trip.status!=='Started')return out({error:'Trip is not active.'},409);
  const children=ordered(route,Number(trip.run_no||1),trip.direction),previous=JSON.stringify((({id,created_at,...data})=>data)(trip));
  if(action==='event'){
   const child=children.find(a=>a.student_id===b.student_id),event=b.event_type,valid=trip.direction==='Pickup'?['Picked up','Absent']:['Dropped at stop','Absent'];
   if(!child||!valid.includes(event))return out({error:'Choose an assigned child and valid event.'},400);
   const done=new Set((trip.events||[]).filter(e=>valid.includes(e.type)).map(e=>e.student_id));
   if(done.has(child.student_id))return out({error:'This child already has a final event.'},409);
   if(children.find(a=>!done.has(a.student_id))?.student_id!==child.student_id)return out({error:'Record children in the assigned stop order.'},409);
   const next={...JSON.parse(previous),events:[...(trip.events||[]),{student_id:child.student_id,type:event,at:now,actor}],updated_at:now};
   const remaining=children.filter(a=>!done.has(a.student_id)&&a.student_id!==child.student_id);
   const steps=[env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='transport_trips' AND id=? AND data=?").bind(JSON.stringify(next),schoolId,trip.id,previous),portalAudit(env,schoolId,false,'transport-event',trip.id)];
   for(const [i,a] of remaining.entries())steps.push(env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'transport_alerts',?,?)").bind(schoolId,crypto.randomUUID(),JSON.stringify({student_id:a.student_id,route_id:route.id,trip_id:trip.id,date:today,at:now,message:'The vehicle has completed '+(children.length-remaining.length)+' of '+children.length+' scheduled stops. Your turn is '+(i+1)+' of '+remaining.length+' remaining.',remaining:remaining.length})));
   const results=await env.DB.batch(steps);if(!results[0].meta?.changes)return out({error:'Trip changed. Refresh and retry.'},409);
   return out({success:true,record:next});
  }
  const done=new Set((trip.events||[]).filter(e=>(trip.direction==='Pickup'?['Picked up','Absent']:['Dropped at stop','Absent']).includes(e.type)).map(e=>e.student_id));
  if(children.some(a=>!done.has(a.student_id)))return out({error:'Record pickup, drop or absence for every child first.'},409);
  const km=reading();if(km<trip.odometer_start_km)return out({error:'Finish reading cannot be below start reading.'},400);
  const picture=photo(),next={...JSON.parse(previous),status:'Completed',odometer_end_km:km,completed_at:now,completed_by:actor,updated_at:now};
  const results=await env.DB.batch([env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='transport_trips' AND id=? AND data=?").bind(JSON.stringify(next),schoolId,trip.id,previous),env.DB.prepare("INSERT INTO neo_transport_photos(trip_id,phase,school_id,photo) VALUES (?,'finish',?,?)").bind(trip.id,schoolId,picture),portalAudit(env,schoolId,false,'transport-finish',trip.id)]);
  if(!results[0].meta?.changes)return out({error:'Trip changed. Refresh and retry.'},409);
  return out({success:true,record:next});
 }catch(e){console.error('Transport operations',e);return out({error:e?.message||'Transport operation failed.'},400)}
}
