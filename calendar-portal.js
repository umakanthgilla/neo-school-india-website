/* NEO School Calendar — clean month calendar */
.neo-calendar-shell{
  margin-top:18px;
}

.neo-calendar-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

.neo-calendar-toolbar h3{
  margin:0;
  text-align:center;
}

.neo-calendar-toolbar button{
  min-width:38px;
}

.neo-calendar-legend{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:12px 18px;
  margin:10px 0 16px;
  font-size:12px;
  color:#666;
}

.neo-calendar-legend span{
  display:inline-flex;
  align-items:center;
  gap:6px;
}

.neo-dot,
.neo-calendar-dot{
  width:7px;
  height:7px;
  border-radius:50%;
  display:inline-block;
  flex:0 0 7px;
}

/* Subtle markers only — no full-cell colour blocks */
.neo-dot.event,
.neo-calendar-dot.event{
  background:#6f9f6f;
}

.neo-dot.holiday,
.neo-calendar-dot.holiday{
  background:#d47782;
}

.neo-dot.meeting,
.neo-calendar-dot.meeting{
  background:#d9954d;
}

.neo-dot.assessment,
.neo-calendar-dot.assessment{
  background:#c9aa42;
}

.neo-dot.academic,
.neo-calendar-dot.academic{
  background:#7894b3;
}

.neo-month-grid{
  display:grid;
  grid-template-columns:repeat(7,minmax(0,1fr));
  border:1px solid #e6e6e6;
  border-radius:10px;
  overflow:hidden;
  background:#fff;
}

.neo-weekday{
  padding:9px 6px;
  text-align:center;
  font-size:12px;
  font-weight:600;
  color:#666;
  background:#f7f7f7;
  border-right:1px solid #e9e9e9;
  border-bottom:1px solid #e6e6e6;
}

.neo-month-day{
  position:relative;
  min-height:78px;
  padding:8px;
  background:#fff;
  border-right:1px solid #eeeeee;
  border-bottom:1px solid #eeeeee;
}

.neo-month-day.empty{
  background:#fafafa;
}

.neo-month-day.today .neo-day-number{
  font-weight:700;
}

.neo-day-number{
  font-size:13px;
  line-height:1;
  color:#444;
}

.neo-calendar-markers{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:4px;
  margin-top:10px;
}

.neo-calendar-dot{
  box-shadow:none;
}

.neo-calendar-details{
  margin-top:22px;
}

.neo-calendar-details h3{
  margin-bottom:10px;
}

.neo-calendar-detail{
  display:flex;
  gap:14px;
  padding:12px 0;
  border-bottom:1px solid #eeeeee;
}

.neo-calendar-detail-date{
  min-width:92px;
  font-size:13px;
  font-weight:600;
  color:#555;
}

.neo-calendar-detail-body{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:5px;
}

.neo-calendar-detail-body strong{
  font-size:15px;
  font-weight:600;
}

.neo-calendar-detail-body p{
  margin:0;
  color:#666;
  line-height:1.5;
}

.neo-calendar-type{
  width:max-content;
  padding:2px 7px;
  border-radius:10px;
  background:#f3f3f3;
  color:#666;
  font-size:11px;
}

.neo-calendar-type.holiday{
  color:#9d4f59;
}

.neo-calendar-type.event{
  color:#4e774e;
}

.neo-calendar-type.meeting{
  color:#9b652d;
}

.neo-calendar-type.assessment{
  color:#806c22;
}

.neo-calendar-type.academic{
  color:#586f89;
}

@media(max-width:700px){
  .neo-calendar-legend{
    gap:8px 12px;
  }

  .neo-month-day{
    min-height:58px;
    padding:6px;
  }

  .neo-weekday{
    font-size:11px;
    padding:8px 3px;
  }

  .neo-day-number{
    font-size:12px;
  }

  .neo-calendar-detail{
    flex-direction:column;
    gap:4px;
  }

  .neo-calendar-detail-date{
    min-width:0;
  }
}
