import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  totalSlides = 2;
  autoTimer: any;
  isAdminOrResp = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.startAutoSlide();
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.isAdminOrResp = user.role === 'admin' || user.role === 'responsable_it';
      } else {
        this.isAdminOrResp = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  startAutoSlide() {
    this.autoTimer = setInterval(() => this.nextSlide(), 5000);
  }

  stopAutoSlide() {
    if (this.autoTimer) clearInterval(this.autoTimer);
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
  }

  prevSlide() {
    this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
  }
}
