import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface CampaignEmailProps {
  name?: string;
  business?: string;
  discount?: string;
  link?: string;
  message?: string;
  unsubscribeLink?: string;
  trackingPixelUrl?: string;
}

export const CampaignEmail = ({
  name = 'Valued Customer',
  business = 'Our Business',
  discount = '20%',
  link = '#',
  message = 'We miss you! Come back and enjoy an exclusive offer.',
  unsubscribeLink = '#',
  trackingPixelUrl = '',
}: CampaignEmailProps) => {
  const previewText = `${business} - ${message.substring(0, 50)}...`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Branded Header */}
          <Section style={header}>
            <Heading style={headerText}>FollowBack</Heading>
            <Text style={tagline}>Win Back Your Customers</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>Hi {name}! 👋</Heading>
            
            <Text style={text}>{message}</Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={link}>
                Claim Your {discount} Off
              </Button>
            </Section>

            <Text style={text}>
              We'd love to see you again at {business}. This special offer is just for you!
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Sent with ❤️ from {business}
            </Text>
            <Link href={unsubscribeLink} style={unsubscribeLinkStyle}>
              Unsubscribe
            </Link>
          </Section>

          {/* Tracking Pixel */}
          {trackingPixelUrl && (
            <Img
              src={trackingPixelUrl}
              width="1"
              height="1"
              alt=""
              style={{ display: 'block' }}
            />
          )}
        </Container>
      </Body>
    </Html>
  );
};

export default CampaignEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#6366f1',
  padding: '32px 24px',
  textAlign: 'center' as const,
};

const headerText = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  lineHeight: '1.2',
};

const tagline = {
  color: '#e0e7ff',
  fontSize: '14px',
  margin: '0',
  fontWeight: '500',
};

const content = {
  padding: '24px 24px 0',
};

const h1 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px',
  lineHeight: '1.4',
};

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const buttonContainer = {
  padding: '24px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e5e7eb',
  marginTop: '32px',
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const unsubscribeLinkStyle = {
  color: '#6366f1',
  fontSize: '12px',
  textDecoration: 'underline',
};
