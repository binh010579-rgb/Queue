-- Kiểm tra số đơn theo trạng thái
SELECT status, COUNT(*) AS so_don
FROM orders
GROUP BY status
ORDER BY status;

-- Kiểm tra thứ tự đơn PENDING
SELECT
  GROUP_CONCAT(id ORDER BY created_at ASC, id ASC SEPARATOR ',') AS thu_tu_thuc_te,
  '9,2,4,5,8,7,11,13,14,16'                                      AS thu_tu_mong_doi,
  IF(GROUP_CONCAT(id ORDER BY created_at ASC, id ASC SEPARATOR ',') = '9,2,4,5,8,7,11,13,14,16',
     'PASS', 'FAIL')                                              AS ket_qua
FROM orders
WHERE status = 'PENDING';
