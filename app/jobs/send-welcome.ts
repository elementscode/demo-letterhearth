import { Job, email } from "@elements/app";
import config from "#config";
import WelcomeEmail from "#app/emails/welcome";
import PaidWelcomeEmail from "#app/emails/paid-welcome";
import { getSubscriber, unsubscribeHeaders } from "#app/shared/services/subscribers";

export interface SendWelcomeJobFields {
  subscriberId: string;
  paid?: boolean;
}

/**
 * The welcome email, for a new subscriber or a new paid subscriber.
 */
export class SendWelcomeJob extends Job<SendWelcomeJobFields> {
  static maxAttempts = 5;

  run() {
    let subscriber = getSubscriber(this.fields.subscriberId);

    if (!subscriber || !subscriber.emailsEnabled) {
      return;
    }

    let unsubscribeUrl = `/unsubscribe/${subscriber.unsubscribeToken}`;

    email({
      to: subscriber.email,
      subject: this.fields.paid
        ? `Thank you for supporting ${config.newsletter.name}`
        : `Welcome to ${config.newsletter.name}`,
      body: this.fields.paid
        ? new PaidWelcomeEmail({ unsubscribeUrl })
        : new WelcomeEmail({ unsubscribeUrl }),
      headers: unsubscribeHeaders(subscriber),
    });
  }
}
