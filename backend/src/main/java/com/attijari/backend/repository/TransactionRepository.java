package com.attijari.backend.repository;

import com.attijari.backend.model.Transaction;
import com.attijari.backend.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByUserOrderByDateDesc(User user, Pageable pageable);
}
