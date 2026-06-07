import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { Observable } from 'rxjs';

export interface Todo {
  id: number;
  title: string;
  description?: string;
  completed?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TodosService {
  private api = inject(ApiService);
  private endpoint = 'todos';

  getTodos(): Observable<Todo[]> {
    return this.api.get<Todo[]>(this.endpoint);
  }

  getTodo(id: number): Observable<Todo> {
    return this.api.get<Todo>(`${this.endpoint}/${id}`);
  }

  createTodo(todo: Partial<Todo>): Observable<Todo> {
    return this.api.post<Todo>(this.endpoint, todo);
  }

  updateTodo(id: number, todo: Partial<Todo>): Observable<Todo> {
    return this.api.put<Todo>(`${this.endpoint}/${id}`, todo);
  }

  deleteTodo(id: number): Observable<void> {
    return this.api.delete<void>(`${this.endpoint}/${id}`);
  }
}
