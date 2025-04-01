
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SideDrawer = ({ isOpen, onClose, title, children, wide }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 bg-black bg-opacity-0  flex justify-end z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
                    onClick={onClose} // Close when clicking outside
                >
                    <motion.div
                        initial={{ x: "100%" }} // Start completely off-screen (right side)
                        animate={{ x: 0 }} // Slide in from the right
                        exit={{ x: "100%" }} // Slide out to the right
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className={`bg-white h-full drop-shadow-xl w-full ${
                            wide ? wide : "max-w-lg"
                        } p-6 relative`}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 ">
                                {title}
                            </h2>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <motion.div
                            key="drawer-content"
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        >
                            {children}
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SideDrawer;
