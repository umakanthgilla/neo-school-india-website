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
          new Date().toISOString(),
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
  if(!name||!city||!owner||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return error('School, city, owner and a 12–128 character password are required.',400);
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
   }else if(typeof b.password==='string'&&b.password.length>=12&&b.password.length<=128){
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
