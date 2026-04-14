package com.example.singletoncomm;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class MessageController {

    private final MessageStore store;

    public MessageController(MessageStore store) {
        this.store = store;
    }

    @PostMapping("/send")
    public ResponseEntity<String> send(@RequestParam String message) {
        store.store(message);
        return ResponseEntity.ok("Stored: " + message);
    }

    @GetMapping("/receive")
    public ResponseEntity<String> receive() {
        String msg = store.retrieve();
        if (msg == null) {
            return ResponseEntity.ok("[No message] — POST may have been routed to a different instance");
        }
        return ResponseEntity.ok("Message: " + msg);
    }
}
