package com.example.singletoncomm;

import org.springframework.stereotype.Component;

@Component
public class MessageStore {

    private String message;

    public void store(String message) {
        this.message = message;
    }

    public String retrieve() {
        return message;
    }
}
