// Controller: Delete Account & Shop Data
const deleteAccount = async (req, res) => {
    try {
        const phone = req.user?.phone;

        if (!phone) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized request"
            });
        }

        // Prisma Transaction so both tables/records delete atomically
        await prisma.$transaction(async (tx) => {
            // 1. User find karein by phone
            const user = await tx.user.findUnique({
                where: { phone: phone }
            });

            // 2. User Delete (Agar Foreign Key constraints cascading hain toh direct clear hoga)
            if (user) {
                await tx.user.delete({
                    where: { id: user.id }
                });
            }

            // 3. Associated Shop Delete by phone/shopCode/ownerPhone
            await tx.shop.deleteMany({
                where: { phone: phone }
            });
        });

        return res.status(200).json({
            success: true,
            message: "Account and associated shop data deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting account:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete account. Internal server error."
        });
    }
};

module.exports = { deleteAccount };