import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, Conversation } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  
  messages: ChatMessage[] = [];
  conversations: Conversation[] = [];
  activeConversationId: string | null = null;
  
  userInput: string = '';
  isTyping: boolean = false;
  user: any = null;

  isLeftSidebarCollapsed: boolean = false;
  isRightSidebarCollapsed: boolean = false;

  private sub: Subscription = new Subscription();

  constructor(
    private chatService: ChatService, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub.add(this.chatService.messages$.subscribe(msgs => {
      this.messages = msgs;
      this.cdr.detectChanges();
      this.scrollToBottom();
    }));

    this.sub.add(this.chatService.conversations$.subscribe(convs => {
      this.conversations = convs;
    }));

    this.sub.add(this.chatService.activeConversationId$.subscribe(id => {
      this.activeConversationId = id;
    }));

    this.sub.add(this.authService.currentUser$.subscribe(u => {
      this.user = u;
    }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  onSend(): void {
    if (!this.userInput.trim() || this.isTyping) return;

    const text = this.userInput;
    this.userInput = '';
    
    // Add user message via service
    this.chatService.addMessage({
      id: Date.now().toString(),
      text: text,
      sender: 'user',
      time: new Date()
    });

    this.isTyping = true;
    this.scrollToBottom();

    // Call service for bot response
    this.chatService.sendMessage(text).subscribe({
      next: (response: string) => {
        this.isTyping = false;
        this.chatService.addMessage({
          id: Date.now().toString(),
          text: response,
          sender: 'bot',
          time: new Date()
        });
        this.scrollToBottom();
      },
      error: () => {
        this.isTyping = false;
        this.chatService.addMessage({
          id: Date.now().toString(),
          text: "Désolé, j'ai rencontré un problème technique.",
          sender: 'bot',
          time: new Date()
        });
        this.scrollToBottom();
      }
    });
  }

  // Conversation Actions
  newConversation(): void {
    this.chatService.createNewConversation();
  }

  selectConversation(id: string): void {
    this.chatService.setActiveConversation(id);
  }

  deleteConversation(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.chatService.deleteConversation(id);
  }

  // Sidebar Actions
  toggleLeftSidebar(): void {
    this.isLeftSidebarCollapsed = !this.isLeftSidebarCollapsed;
  }

  toggleRightSidebar(): void {
    this.isRightSidebarCollapsed = !this.isRightSidebarCollapsed;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.scrollContainer) {
          this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        }
      } catch (err) {}
    }, 100);
  }
}
