export default {
    general: {
        error: 'An error occurred!',
        success: 'Operation successful!',
        noPermission: 'You do not have permission for this action!',
        notFound: 'Not found!',
    },
    ticket: {
        created: 'Ticket created!',
        closed: 'Ticket closed.',
        reopened: 'Ticket reopened.',
        claimed: 'Ticket claimed.',
        unclaimed: 'Ticket unclaimed.',
        transferred: 'Ticket transferred.',
        blacklisted: 'You cannot create tickets because you are blacklisted!',
        maxReached: 'You have reached the maximum number of open tickets ({max})!',
        notTicketChannel: 'This command can only be used in ticket channels!',
        alreadyClaimed: 'This ticket is already claimed!',
        notClaimed: 'This ticket is not claimed yet!',
        welcomeMessage: 'Hello! Your support request has been received. Please describe your issue in detail and we will help you as soon as possible.',
        closeMessage: 'Ticket closed. Happy to help!',
    },
    commands: {
        setup: {
            success: 'Bot has been set up successfully!',
            categoryCreated: 'Ticket category created.',
            panelSent: 'Ticket panel sent.',
        },
        blacklist: {
            added: '{user} has been blacklisted.',
            removed: '{user} has been removed from blacklist.',
            alreadyBlacklisted: 'This user is already blacklisted!',
            notBlacklisted: 'This user is not blacklisted!',
        },
        canned: {
            created: 'Canned response created: {name}',
            deleted: 'Canned response deleted: {name}',
            notFound: 'Canned response not found!',
            used: 'Canned response used.',
        },
    },
    panel: {
        title: '🎫 Support Request',
        description: 'Click the button below to create a support request.',
        buttonLabel: 'Open Ticket',
    },
};
