package com.attijari.backend.controller;

import com.attijari.backend.model.User;
import com.attijari.backend.repository.UserRepository;
import com.attijari.backend.repository.TransactionRepository;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Optional<User> userOpt = userRepository.findByCin(request.getCin());
        Map<String, Object> response = new HashMap<>();

        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("error", "CIN ou mot de passe incorrect");
            return ResponseEntity.ok(response);
        }

        User user = userOpt.get();
        if (!user.isActive()) {
            response.put("success", false);
            response.put("error", "Compte désactivé. Contactez votre agence.");
            return ResponseEntity.ok(response);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            response.put("success", false);
            response.put("error", "CIN ou mot de passe incorrect");
            return ResponseEntity.ok(response);
        }

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        response.put("success", true);
        response.put("role", user.getRole().name());
        response.put("first_name", user.getFirstName());
        response.put("last_name", user.getLastName());
        response.put("user_id", user.getId());
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User userRequest) {
        Map<String, Object> response = new HashMap<>();
        
        if (userRepository.findByCin(userRequest.getCin()).isPresent()) {
            response.put("success", false);
            response.put("error", "Ce CIN est déjà enregistré. Connectez-vous.");
            return ResponseEntity.ok(response);
        }

        userRequest.setPassword(passwordEncoder.encode(userRequest.getPassword()));
        userRepository.save(userRequest);

        response.put("success", true);
        response.put("message", "Compte créé avec succès. Vous pouvez maintenant vous connecter.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/profile/{id}")
    public ResponseEntity<?> getProfile(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        Map<String, Object> response = new HashMap<>();

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("cin", user.getCin());
            userData.put("first_name", user.getFirstName());
            userData.put("last_name", user.getLastName());
            userData.put("card_number", user.getCardNumber());
            userData.put("card_expiry", user.getCardExpiry());
            userData.put("card_type", user.getCardType());
            userData.put("role", user.getRole());
            userData.put("compte_courant", user.getCompteCourant());
            userData.put("compte_epargne", user.getCompteEpargne());
            
            // Mask card number
            if (user.getCardNumber() != null) {
                String[] parts = user.getCardNumber().split(" ");
                StringBuilder masked = new StringBuilder();
                for (int i = 0; i < parts.length; i++) {
                    masked.append(i == parts.length - 1 ? parts[i] : "****");
                    if (i < parts.length - 1) masked.append(" ");
                }
                userData.put("card_number_masked", masked.toString());
            }

            userData.put("transactions", transactionRepository.findByUserOrderByDateDesc(user, PageRequest.of(0, 5)));

            response.put("success", true);
            response.put("user", userData);
        } else {
            response.put("success", false);
            response.put("error", "Utilisateur introuvable");
        }

        return ResponseEntity.ok(response);
    }

    @Data
    public static class LoginRequest {
        private String cin;
        private String password;
    }
}
