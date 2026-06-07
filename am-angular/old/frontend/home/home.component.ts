import { Component } from '@angular/core';
import { FaqComponent } from '@components/faq/faq.component';
import { FeaturesComponent } from '@components/features/features.component';
import { HeroComponent } from '@components/hero/hero.component';
import { PricingComponent } from '@components/pricing/pricing.component';
import { TestimonialsComponent } from '@components/testimonials/testimonials.component';

@Component({
  selector: 'app-home',
  imports: [FeaturesComponent, PricingComponent, FaqComponent, HeroComponent, TestimonialsComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent {

}
