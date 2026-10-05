-- ── หาของที่วันที่จ่ายออกน่าจะเพี้ยน ────────────────────────────
-- อ่านอย่างเดียว ไม่แก้อะไร รันได้ปลอดภัย
--
-- หลักการ: ของที่ถูก "เพิ่มเข้าใบ DO" ทีหลัง จะมี dispatched_at
-- เท่ากับของชิ้นแรกในใบเป๊ะ ๆ ทั้งที่ความจริงกดเพิ่มคนละวัน
-- เทียบกับวันที่ในประวัติการเคลื่อนไหวจะเห็นว่าไม่ตรงกัน
--
-- หมายเหตุ: dispatched_at เก็บเป็น timestamptz ฐานข้อมูลคิดเป็น UTC
-- ต้องแปลงเป็นเวลาไทยก่อนเทียบ ไม่งั้นของที่จ่ายก่อน 7 โมงเช้าจะดูเหมือนเพี้ยนทั้งที่ถูก

select
  i.sn,
  i.name,
  d.do_no,
  (i.dispatched_at at time zone 'Asia/Bangkok')::date as วันที่จ่ายออกที่บันทึกไว้,
  t.tx_date                                           as วันที่ในประวัติเคลื่อนไหว,
  t.note
from inventory i
join do_items di    on di.sn = i.sn
join do_headers d   on d.id = di.do_header_id
join transactions t on t.sn = i.sn and t.note like '%เพิ่มเข้าใบ%'
where i.status = 'Sold'
  and (i.dispatched_at at time zone 'Asia/Bangkok')::date <> t.tx_date
order by t.tx_date desc;

-- แถวที่ขึ้นมาคือของที่ต้องแก้
-- เอา sn กับ "วันที่ในประวัติเคลื่อนไหว" ไปใส่ใน fix-dispatched-at.sql
--
-- ไม่มีแถวเลย = ไม่มีของตกค้าง เรียบร้อยดี
