import { supabase } from '../supabase/config';

/**
 * Centralized service for system notifications
 */
export const notificationService = {
    /**
     * Create a new notification record in the database
     * @param {Object} params
     * @param {string} params.title - Notification title
     * @param {string} params.description - Detailed message
     * @param {'info' | 'success' | 'warning' | 'error'} [params.type='info'] - Type of notification
     * @param {string} [params.link] - Optional link to navigate when clicked
     * @param {string} [params.user_id] - Optional user_id if notification is private
     */
    async add({ title, description, type = 'info', link = null, user_id = null }) {
        try {
            const { error } = await supabase
                .from('notifications')
                .insert([{
                    title,
                    description,
                    type,
                    link,
                    user_id,
                    is_read: false
                }]);
            
            if (error) console.error('Error creating notification:', error);
            return !error;
        } catch (err) {
            console.error('Notification service error:', err);
            return false;
        }
    }
};
