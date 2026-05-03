<?php
$dir = __DIR__;
$files = glob($dir . '/*.{html,js,php}', GLOB_BRACE);

foreach ($files as $file) {
    if (basename($file) === 'rebrand.php') continue;
    
    $content = file_get_contents($file);
    $oldContent = $content;
    
    // Core brand replacements
    $content = str_replace('IA Call Center', 'AI CALL CENTER', $content);
    $content = str_replace('IA CALL CENTER', 'AI CALL CENTER', $content);
    $content = str_replace('Chatbot IA', 'Chatbot AI', $content);
    $content = str_replace('Assistant IA', 'Assistant AI', $content);
    
    // Uppercase matches
    $content = str_replace('>IA<', '>AI<', $content);
    
    // Cache busting
    $content = preg_replace('/\?v=\d+/', '?v=555', $content);

    if ($content !== $oldContent) {
        file_put_contents($file, $content);
        echo "Rebranded: " . basename($file) . "\n";
    }
}
echo "Global Rebrand Complete.";
?>
