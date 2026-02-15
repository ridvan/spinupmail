export const toAttachmentResponse = (attachment: {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string | null;
  contentId: string | null;
}) => ({
  id: attachment.id,
  filename: attachment.filename,
  contentType: attachment.contentType,
  size: attachment.size,
  disposition: attachment.disposition,
  contentId: attachment.contentId,
  downloadPath: `/api/emails/${attachment.emailId}/attachments/${attachment.id}`,
});
