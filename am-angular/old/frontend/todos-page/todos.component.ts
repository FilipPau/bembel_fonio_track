import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Todo, TodosService } from '@services/todos.service';

@Component({
  selector: 'app-todos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './todos.component.html'
})
export class TodosComponent {
  private todosService = inject(TodosService);
  private fb = inject(FormBuilder);

  todos = signal<Todo[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  editingId = signal<number | null>(null);

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', Validators.maxLength(500)]
  });

  // Stats computed value
  stats = computed(() => {
    const todos = this.todos();
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, completionRate };
  });

  constructor() {
    this.fetchTodos();
  }

  fetchTodos() {
    this.loading.set(true);
    this.error.set(null);
    
    this.todosService.getTodos().subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load todos. Please try again.');
        this.loading.set(false);
      }
    });
  }

  addTodo() {
    if (this.form.invalid) return;
    
    this.loading.set(true);
    this.error.set(null);
    
    this.todosService.createTodo(this.form.value).subscribe({
      next: (todo) => {
        this.todos.set([...this.todos(), todo]);
        this.form.reset();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to add todo. Please try again.');
        this.loading.set(false);
      }
    });
  }

  editTodo(todo: Todo) {
    this.editingId.set(todo.id);
    this.form.patchValue({ 
      title: todo.title, 
      description: todo.description || '' 
    });
  }

  updateTodo() {
    const id = this.editingId();
    if (!id || this.form.invalid) return;
    
    this.loading.set(true);
    this.error.set(null);
    
    this.todosService.updateTodo(id, this.form.value).subscribe({
      next: (updated) => {
        this.todos.set(this.todos().map(t => t.id === id ? updated : t));
        this.editingId.set(null);
        this.form.reset();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to update todo. Please try again.');
        this.loading.set(false);
      }
    });
  }

  deleteTodo(id: number) {
    this.loading.set(true);
    this.error.set(null);
    
    this.todosService.deleteTodo(id).subscribe({
      next: () => {
        this.todos.set(this.todos().filter(t => t.id !== id));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to delete todo. Please try again.');
        this.loading.set(false);
      }
    });
  }

  toggleComplete(todo: Todo) {
    this.todosService.updateTodo(todo.id, { completed: !todo.completed }).subscribe({
      next: (updated) => {
        this.todos.set(this.todos().map(t => t.id === todo.id ? updated : t));
      },
      error: () => {
        this.error.set('Failed to update todo status. Please try again.');
      }
    });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.form.reset();
  }

  clearError() {
    this.error.set(null);
  }

  retryFetch() {
    this.fetchTodos();
  }
}
