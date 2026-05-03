package com.attijari.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 8)
    private String cin;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String password;

    @Column(name = "card_number", length = 19)
    private String cardNumber;

    @Column(name = "card_expiry", length = 7)
    private String cardExpiry;

    @Builder.Default
    @Column(name = "card_type", length = 30)
    private String cardType = "Visa Gold";

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.user;

    @Builder.Default
    @Column(name = "compte_courant")
    private BigDecimal compteCourant = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "compte_epargne")
    private BigDecimal compteEpargne = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "is_active")
    private boolean isActive = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    public enum Role {
        user, admin
    }
}
