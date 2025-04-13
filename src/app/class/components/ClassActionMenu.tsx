// "use client";

// import React, { useState, useTransition } from "react";
// import { Button } from "@/components/ui/button";
// import {
//   MoreVertical,
//   SquarePen,
//   Trash2,
//   Mail,
//   Loader2,
//   Copy,
//   HelpCircle,
// } from "lucide-react";
// import Link from "next/link";
// import {
//   DropdownMenu,
//   DropdownMenuTrigger,
//   DropdownMenuContent,
//   DropdownMenuLabel,
//   DropdownMenuItem,
//   DropdownMenuSeparator,
// } from "@/components/ui/dropdown-menu";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
// import {
//   Dialog,
//   DialogClose,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { toast } from "sonner";
// import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
// import removeClassFromTeacher from "@/server/actions/removeClassFromTeacher";
// import { ClassByIdOptions } from "@/app/api/queryOptions";
// import { cn } from "@/lib/utils";
// import { sendEmails } from "../actions/sendStudentDashboardEmails";

// interface ClassActionMenuProps {
//   classId: string;
//   className?: string;
// }

// const ClassActionMenu: React.FC<ClassActionMenuProps> = ({
//   classId,
//   className,
// }) => {
//   const queryClient = useQueryClient();
//   const [courseToDelete, setCourseToDelete] = useState<{
//     id: string;
//     name: string;
//   } | null>(null);
//   const [deleteCourseText, setDeleteCourseText] = useState("");
//   const [isSendingEmails, startTransition] = useTransition();

//   const { data, error, isLoading } = useQuery(ClassByIdOptions(classId));

//   // This mutation handles deleting the class
//   const deleteMutation = useMutation({
//     mutationFn: (classId: string) =>
//       removeClassFromTeacher(classId, course.role),
//     onSuccess: () => {
//       void queryClient.invalidateQueries({ queryKey: ["classes"] });
//       toast.success(
//         `Class "${course.class_name}" has been successfully deleted.`,
//       );
//       // Reset dialog state upon successful deletion
//       setCourseToDelete(null);
//       setDeleteCourseText("");
//     },
//     onError: () => {
//       toast.error("Failed to delete class! Please try again in a moment.");
//     },
//   });

//   const copyToClipboard = () => {
//     navigator.clipboard
//       .writeText(
//         `https://app.classclarus.com/import?import_code=${course.class_code}`,
//       )
//       .then(
//         () => {
//           toast.success(
//             "Class behavior/rewards share link has been copied to your clipboard.",
//           );
//         },
//         (err) => {
//           console.error("Could not copy text: ", err);
//           toast.error("Failed to copy class code.");
//         },
//       );
//   };

//   const handleSendEmails = () => {
//     startTransition(async () => {
//       try {
//         await sendEmails({ classId });
//         toast.success(
//           "Emails Sent! It can take up to several hours for the emails to arrive.",
//         );
//       } catch (error: unknown) {
//         console.error("Error sending emails:", error);
//         toast.error(
//           `Failed to send emails! ${
//             error instanceof Error
//               ? error.message
//               : "An error occurred while sending emails."
//           }`,
//         );
//       }
//     });
//   };

//   const handleCopyClassCode = () => {
//     navigator.clipboard
//       .writeText(
//         `https://app.classclarus.com/classes?join_code=${course.class_code}`,
//       )
//       .then(
//         () => {
//           toast.success("Class invite link has been copied to your clipboard.");
//         },
//         (err) => {
//           console.error("Could not copy text: ", err);
//           toast.error("Failed to copy class code.");
//         },
//       );
//   };

//   // Function to handle class deletion
//   const handleDeleteClass = () => {
//     if (!courseToDelete) return;

//     if (courseToDelete.name !== deleteCourseText) {
//       toast.warning(
//         "Class names do not match! This is case-sensitive. Please double check what you typed and try again.",
//       );
//       return;
//     }

//     deleteMutation.mutate(courseToDelete.id);
//     // We do NOT reset the state here; we do that in onSuccess or onError
//   };

//   return (
//     <>
//       {/* Action Dropdown Menu */}
//       <DropdownMenu>
//         <DropdownMenuTrigger asChild>
//           <Button
//             variant="outline"
//             size={"icon"}
//             className={cn(className)}
//             disabled={isSendingEmails}
//           >
//             <MoreVertical className="h-5 w-5" />
//             <span className="sr-only">Open menu</span>
//           </Button>
//         </DropdownMenuTrigger>
//         <DropdownMenuContent align="end">
//           <DropdownMenuLabel>Actions</DropdownMenuLabel>
//           <DropdownMenuItem asChild>
//             <Link href={`/classes/${classId}/edit`}>
//               <SquarePen className="mr-2 h-4 w-4" />
//               Edit
//             </Link>
//           </DropdownMenuItem>
//           <DropdownMenuItem onClick={copyToClipboard}>
//             <Copy className="mr-2 h-4 w-4" /> Share behaviors/rewards
//           </DropdownMenuItem>
//           <DropdownMenuItem
//             onClick={handleSendEmails}
//             disabled={isSendingEmails}
//           >
//             <Mail className="mr-2 h-4 w-4" />
//             Email dashboards
//             <TooltipProvider>
//               <Tooltip delayDuration={0}>
//                 <TooltipTrigger>
//                   <HelpCircle className="ml-1" size={16} />
//                 </TooltipTrigger>
//                 <TooltipContent className="max-w-sm">
//                   <p>
//                     It may take up to several hours for the emails to arrive. In
//                     testing, they never took more than 10 minutes to arrive.
//                     Nonetheless, please plan accordingly.
//                   </p>
//                 </TooltipContent>
//               </Tooltip>
//             </TooltipProvider>
//           </DropdownMenuItem>
//           <DropdownMenuItem
//             onClick={handleCopyClassCode}
//             disabled={isSendingEmails}
//           >
//             <Copy className="mr-2 h-4 w-4" />
//             Invite teachers
//             <TooltipProvider>
//               <Tooltip delayDuration={0}>
//                 <TooltipTrigger>
//                   <HelpCircle className="ml-1" size={16} />
//                 </TooltipTrigger>
//                 <TooltipContent className="max-w-sm">
//                   <p>
//                     This will copy your class code. Send it to other teachers so
//                     they can join as assistant teachers.{" "}
//                     <strong>
//                       Assistant teachers can only apply behaviors and
//                       mark/unmark tasks complete.
//                     </strong>
//                   </p>
//                 </TooltipContent>
//               </Tooltip>
//             </TooltipProvider>
//           </DropdownMenuItem>
//           <DropdownMenuSeparator />
//           <DropdownMenuItem
//             className="text-destructive hover:!bg-destructive hover:text-foreground flex cursor-pointer items-center font-bold"
//             onSelect={() =>
//               setCourseToDelete({ id: classId, name: course.class_name })
//             }
//             disabled={isSendingEmails || deleteMutation.isPending}
//           >
//             {deleteMutation.isPending ? (
//               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//             ) : (
//               <Trash2 className="mr-2 h-4 w-4" />
//             )}
//             Delete
//           </DropdownMenuItem>
//         </DropdownMenuContent>
//       </DropdownMenu>

//       {/* Delete Confirmation Dialog */}
//       {courseToDelete && (
//         <Dialog
//           // Keep the dialog open if deletion is pending
//           open={!!courseToDelete}
//           onOpenChange={(open) => {
//             // Only allow closing if we're not deleting
//             if (!open && !deleteMutation.isPending) {
//               setCourseToDelete(null);
//               setDeleteCourseText("");
//             }
//           }}
//         >
//           <DialogContent className="sm:max-w-md">
//             <DialogHeader>
//               <DialogTitle>Delete class</DialogTitle>
//               <DialogDescription>
//                 Please type the class name,{" "}
//                 <span className="font-bold">{courseToDelete.name}</span>, below
//                 to confirm deletion. Deleting a class is <b>IRREVERSIBLE</b>.
//               </DialogDescription>
//             </DialogHeader>
//             <div className="flex items-center space-x-2">
//               <div className="grid flex-1 gap-2">
//                 <Label htmlFor="class-to-delete" className="sr-only">
//                   Class to delete
//                 </Label>
//                 <Input
//                   id="class-to-delete"
//                   placeholder="Type class name"
//                   value={deleteCourseText}
//                   onChange={(e) => setDeleteCourseText(e.target.value)}
//                   disabled={isSendingEmails || deleteMutation.isPending}
//                 />
//               </div>
//             </div>
//             <DialogFooter className="sm:justify-start">
//               <DialogClose asChild>
//                 <Button
//                   type="button"
//                   variant="outline"
//                   disabled={isSendingEmails || deleteMutation.isPending}
//                 >
//                   Cancel
//                 </Button>
//               </DialogClose>
//               <Button
//                 onClick={handleDeleteClass}
//                 variant="destructive"
//                 disabled={deleteMutation.isPending || isSendingEmails}
//               >
//                 {deleteMutation.isPending ? (
//                   <>
//                     <Loader2 className="mr-2 h-6 w-6 animate-spin" />
//                     Deleting...
//                   </>
//                 ) : (
//                   "Delete class"
//                 )}
//               </Button>
//             </DialogFooter>
//           </DialogContent>
//         </Dialog>
//       )}

//       {/* Global Loading Overlay for Sending Emails */}
//       {isSendingEmails && (
//         <div className="bg-opacity-50 fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black">
//           <Loader2 className="h-24 w-24 animate-spin" />
//           <div className="text-3xl font-bold">Letting the email owls fly!</div>
//         </div>
//       )}
//     </>
//   );
// };

// export default ClassActionMenu;
