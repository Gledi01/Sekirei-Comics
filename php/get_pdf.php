<?php
ob_start();
$vol = isset($_GET['vol']) ? $_GET['vol'] : '';
// Path ke folder comics
$file_path = __DIR__ . "/../comics/" . $vol . ".pdf";

if (file_exists($file_path)) {
    // Bersihkan buffer agar tidak ada spasi yang merusak PDF
    ob_end_clean();
    header('Content-Type: application/pdf');
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . filesize($file_path));
    readfile($file_path);
    exit;
} else {
    http_response_code(404);
    echo "File $vol.pdf tidak ditemukan.";
}
?>
